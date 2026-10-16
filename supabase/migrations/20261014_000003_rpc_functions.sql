-- ============================================================================
-- PerformIQ — Trusted Atomic RPC Operations
-- Authoritative Business Rules & State Machine Handlers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Submit Goals Operation
-- Invariants: 3-7 goals, exactly 100% total weight, stage is 'goals_open'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_goals(p_cycle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_cycle_stage TEXT;
  v_goal_count INTEGER;
  v_total_weight INTEGER;
BEGIN
  -- Verify user tenant
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  -- Verify cycle stage
  SELECT stage INTO v_cycle_stage FROM public.review_cycles
  WHERE id = p_cycle_id AND tenant_id = v_tenant_id;

  IF v_cycle_stage IS NULL THEN
    RAISE EXCEPTION 'Review cycle not found.';
  END IF;

  IF v_cycle_stage <> 'goals_open' THEN
    RAISE EXCEPTION 'Goal submission is only allowed during the Goals Open stage (current stage: %).', v_cycle_stage;
  END IF;

  -- Verify goal count and weight sum
  SELECT COUNT(*), COALESCE(SUM(weight), 0)
  INTO v_goal_count, v_total_weight
  FROM public.goals
  WHERE cycle_id = p_cycle_id AND user_id = v_user_id AND status IN ('draft', 'returned');

  IF v_goal_count < 3 OR v_goal_count > 7 THEN
    RAISE EXCEPTION 'Goal validation failed: You must have between 3 and 7 goals (currently %).', v_goal_count;
  END IF;

  IF v_total_weight <> 100 THEN
    RAISE EXCEPTION 'Goal validation failed: Goal weights must total exactly 100 percent (currently % percent).', v_total_weight;
  END IF;

  -- Transition goals to pending_approval
  UPDATE public.goals
  SET status = 'pending_approval', updated_at = NOW()
  WHERE cycle_id = p_cycle_id AND user_id = v_user_id AND status IN ('draft', 'returned');

  -- Audit log
  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (
    v_tenant_id,
    v_user_id,
    'SUBMIT_GOALS',
    'goals',
    p_cycle_id,
    jsonb_build_object('goal_count', v_goal_count, 'total_weight', v_total_weight)
  );

  RETURN jsonb_build_object(
    'success', true,
    'goal_count', v_goal_count,
    'total_weight', v_total_weight,
    'status', 'pending_approval'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Advance Review Cycle Operation (Admin Only)
-- State Machine: draft -> goals_open -> tracking -> self_review -> manager_review -> calibration -> released -> closed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_review_cycle(
  p_cycle_id UUID,
  p_target_stage TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_tenant_id UUID;
  v_current_stage TEXT;
  v_valid_next TEXT;
BEGIN
  -- Verify admin status
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can advance appraisal cycle stages.';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_admin_id;

  SELECT stage INTO v_current_stage FROM public.review_cycles
  WHERE id = p_cycle_id AND tenant_id = v_tenant_id;

  IF v_current_stage IS NULL THEN
    RAISE EXCEPTION 'Review cycle not found in your organization.';
  END IF;

  -- Authoritative state machine mapping
  v_valid_next := CASE v_current_stage
    WHEN 'draft' THEN 'goals_open'
    WHEN 'goals_open' THEN 'tracking'
    WHEN 'tracking' THEN 'self_review'
    WHEN 'self_review' THEN 'manager_review'
    WHEN 'manager_review' THEN 'calibration'
    WHEN 'calibration' THEN 'released'
    WHEN 'released' THEN 'closed'
    ELSE NULL
  END;

  IF v_valid_next IS NULL OR v_valid_next <> p_target_stage THEN
    RAISE EXCEPTION 'Illegal stage transition from % to %. Next valid stage is %.',
      v_current_stage, p_target_stage, COALESCE(v_valid_next, 'none (cycle closed)');
  END IF;

  -- Advance stage
  UPDATE public.review_cycles
  SET stage = p_target_stage,
      released_at = CASE WHEN p_target_stage = 'released' THEN NOW() ELSE released_at END,
      updated_at = NOW()
  WHERE id = p_cycle_id AND tenant_id = v_tenant_id;

  -- Audit log
  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (
    v_tenant_id,
    v_admin_id,
    'STAGE_TRANSITION',
    'review_cycles',
    p_cycle_id,
    jsonb_build_object(
      'previous_stage', v_current_stage,
      'new_stage', p_target_stage,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', p_cycle_id,
    'previous_stage', v_current_stage,
    'stage', p_target_stage
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Calibrate Review Operation (Admin Only)
-- Invariants: 1.0 - 5.0 score, reason >= 10 non-whitespace chars, cycle in calibration
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calibrate_review(
  p_cycle_id UUID,
  p_user_id UUID,
  p_score NUMERIC,
  p_reason TEXT,
  p_nine_box TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_tenant_id UUID;
  v_current_stage TEXT;
  v_original_score NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only committee admins can calibrate scores.';
  END IF;

  IF p_score < 1.0 OR p_score > 5.0 THEN
    RAISE EXCEPTION 'Calibrated score must be between 1.0 and 5.0 (received %).', p_score;
  END IF;

  IF length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Calibration rationale must be at least 10 non-whitespace characters.';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_admin_id;

  SELECT stage INTO v_current_stage FROM public.review_cycles
  WHERE id = p_cycle_id AND tenant_id = v_tenant_id;

  IF v_current_stage <> 'calibration' THEN
    RAISE EXCEPTION 'Calibration can only take place during the Calibration stage (current: %).', v_current_stage;
  END IF;

  -- Fetch original score from manager review or prior snapshot
  SELECT overall_rating INTO v_original_score
  FROM public.manager_reviews
  WHERE cycle_id = p_cycle_id AND user_id = p_user_id AND tenant_id = v_tenant_id;

  IF v_original_score IS NULL THEN
    v_original_score := p_score;
  END IF;

  -- Insert calibration record
  INSERT INTO public.calibrations (
    tenant_id, cycle_id, user_id, original_score, adjusted_score, reason, calibrated_by, nine_box_quadrant
  ) VALUES (
    v_tenant_id, p_cycle_id, p_user_id, v_original_score, p_score, trim(p_reason), v_admin_id, p_nine_box
  );

  -- Upsert final results record
  INSERT INTO public.final_results (
    tenant_id, cycle_id, user_id, final_score, rating_label, status
  ) VALUES (
    v_tenant_id, p_cycle_id, p_user_id, p_score,
    CASE
      WHEN p_score >= 4.5 THEN 'Outstanding'
      WHEN p_score >= 3.5 THEN 'Exceeds Expectations'
      WHEN p_score >= 2.5 THEN 'Meets Expectations'
      WHEN p_score >= 1.5 THEN 'Needs Improvement'
      ELSE 'Unsatisfactory'
    END,
    'pending'
  )
  ON CONFLICT (cycle_id, user_id) DO UPDATE SET
    final_score = EXCLUDED.final_score,
    rating_label = EXCLUDED.rating_label,
    updated_at = NOW();

  -- Audit log
  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (
    v_tenant_id,
    v_admin_id,
    'CALIBRATION_ADJUSTMENT',
    'calibrations',
    p_user_id,
    jsonb_build_object(
      'cycle_id', p_cycle_id,
      'original_score', v_original_score,
      'adjusted_score', p_score,
      'reason', trim(p_reason)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'original_score', v_original_score,
    'adjusted_score', p_score
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Release Cycle Operation (Admin Only)
-- Atomic publication of final appraisal outcomes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_cycle(p_cycle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_tenant_id UUID;
  v_current_stage TEXT;
  v_released_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can publish review cycle outcomes.';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_admin_id;

  SELECT stage INTO v_current_stage FROM public.review_cycles
  WHERE id = p_cycle_id AND tenant_id = v_tenant_id;

  IF v_current_stage <> 'calibration' THEN
    RAISE EXCEPTION 'Cycle must be in Calibration stage to release outcomes (current: %).', v_current_stage;
  END IF;

  -- Atomically release all final results
  UPDATE public.final_results
  SET status = 'released', released_at = NOW(), updated_at = NOW()
  WHERE cycle_id = p_cycle_id AND tenant_id = v_tenant_id;

  GET DIAGNOSTICS v_released_count = ROW_COUNT;

  -- Advance cycle stage to released
  UPDATE public.review_cycles
  SET stage = 'released', released_at = NOW(), updated_at = NOW()
  WHERE id = p_cycle_id AND tenant_id = v_tenant_id;

  -- Audit log
  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (
    v_tenant_id,
    v_admin_id,
    'CYCLE_RELEASE',
    'review_cycles',
    p_cycle_id,
    jsonb_build_object('released_results_count', v_released_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', p_cycle_id,
    'released_results_count', v_released_count,
    'stage', 'released'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Acknowledge Result Operation (Employee)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acknowledge_result(p_result_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE public.final_results
  SET status = 'acknowledged', acknowledged_at = NOW(), updated_at = NOW()
  WHERE id = p_result_id AND user_id = v_user_id AND status = 'released';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Result not found or not in released status.';
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'acknowledged');
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Dispute Result Operation (Employee)
-- Invariant: Must be within dispute window (7 days by default)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispute_result(p_result_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_released_at TIMESTAMPTZ;
  v_dispute_window INTEGER;
BEGIN
  IF length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Dispute reason must be at least 10 characters.';
  END IF;

  SELECT r.released_at, c.dispute_window_days
  INTO v_released_at, v_dispute_window
  FROM public.final_results r
  JOIN public.review_cycles c ON c.id = r.cycle_id
  WHERE r.id = p_result_id AND r.user_id = v_user_id AND r.status = 'released';

  IF v_released_at IS NULL THEN
    RAISE EXCEPTION 'Result not found or not in released status.';
  END IF;

  IF NOW() > (v_released_at + (v_dispute_window || ' days')::INTERVAL) THEN
    RAISE EXCEPTION 'The % day dispute window for this appraisal cycle has expired.', v_dispute_window;
  END IF;

  UPDATE public.final_results
  SET status = 'disputed', dispute_reason = trim(p_reason), disputed_at = NOW(), updated_at = NOW()
  WHERE id = p_result_id AND user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'status', 'disputed');
END;
$$;

