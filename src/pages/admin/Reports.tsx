import React, { useState } from 'react'
import { useApp } from '../../app/AppContext'
import { MetricCard } from '../../components/ui/MetricCard'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import { RATING_BANDS } from '../../lib/scoring'
import { BarChart3, Calendar, PieChart, TrendingUp, Users, Target, Award } from 'lucide-react'

export const AdminReports: React.FC = () => {
  const { activeCycle, allCycles, switchActiveCycle } = useApp()
  const [selectedDept, setSelectedDept] = useState('all')

  const departmentData = [
    { name: 'Engineering', completionRate: 92, goalAttainment: 89, headcount: 5, avgRating: 4.45 },
    { name: 'Product & Design', completionRate: 85, goalAttainment: 82, headcount: 4, avgRating: 4.3 },
  ]

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Clean Dashboard Standard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Performance & Talent Benchmarks
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Cross-department score distribution, completion metrics & calibration analysis
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs relative z-30">
          <CustomDropdown
            value={activeCycle.id}
            onChange={switchActiveCycle}
            align="right"
            options={allCycles.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />
        </div>
      </div>

      {/* High Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Overall Participation"
          value="89%"
          subtitle="Organization-wide rate"
          icon={<Users className="w-4 h-4 text-[#8B7CFF]" />}
        />
        <MetricCard
          title="Average Final Rating"
          value="4.38"
          subtitle="Out of 5.0 scale"
          icon={<Award className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />}
        />
        <MetricCard
          title="Goal Execution Index"
          value="86%"
          subtitle="Milestones delivered"
          icon={<Target className="w-4 h-4 text-[#FFB454]" />}
        />
        <MetricCard
          title="Calibration Committee"
          value="100%"
          subtitle="Variances resolved"
          icon={<BarChart3 className="w-4 h-4 text-[#8B7CFF]" />}
        />
      </div>

      {/* Department Comparison Cards */}
      <div className="dark-glass-card conic-border-glow p-6 sm:p-8 space-y-6">
        <div className="pb-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Department Performance & Execution Comparison
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#8D96AA] font-mono mt-0.5">
              Benchmarked against target organizational SLAs
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 dark:text-[#8D96AA] hidden sm:inline">
            H1-2026 Cycle Cohort
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {departmentData.map((dept) => (
            <div
              key={dept.name}
              className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] space-y-5 text-xs"
            >
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm">
                <span>{dept.name}</span>
                <span className="text-xs font-mono font-normal text-slate-500 dark:text-[#8D96AA]">
                  {dept.headcount} Team Members
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-600 dark:text-[#8D96AA] font-mono text-[11px]">
                    <span>Review Cycle Completion Rate</span>
                    <span className="font-bold text-slate-900 dark:text-white">{dept.completionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-200/80 dark:bg-white/[0.08] border border-slate-300/60 dark:border-transparent rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:to-[#4FE3C1] h-full rounded-full transition-all duration-500"
                      style={{ width: `${dept.completionRate}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-600 dark:text-[#8D96AA] font-mono text-[11px]">
                    <span>Strategic Goal Attainment</span>
                    <span className="font-bold text-slate-900 dark:text-white">{dept.goalAttainment}%</span>
                  </div>
                  <div className="w-full bg-slate-200/80 dark:bg-white/[0.08] border border-slate-300/60 dark:border-transparent rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:to-[#4FE3C1] h-full rounded-full transition-all duration-500"
                      style={{ width: `${dept.goalAttainment}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between font-mono">
                  <span className="text-slate-500 dark:text-[#8D96AA]">Average Composite Score:</span>
                  <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                    {dept.avgRating} <span className="text-xs font-normal text-slate-400 dark:text-[#8D96AA]">/ 5.0</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gaussian Calibration Quota vs Actual */}
      <div className="dark-glass-card p-6 sm:p-8 space-y-5">
        <div className="pb-3 border-b border-slate-100 dark:border-white/[0.08]">
          <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Organizational Rating Quota Alignment
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#8D96AA] font-mono mt-0.5">
            Statistical Gaussian distribution vs actual manager submissions
          </p>
        </div>

        <div className="space-y-3.5 text-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06]">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Band 5: Outstanding (4.50 – 5.00)</span>
              <span className="text-slate-500 dark:text-[#8D96AA] text-[11px]">Recommended target: 15% – 20%</span>
            </div>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border-indigo-200/90 dark:text-[#4FE3C1] dark:bg-[#4FE3C1]/10 px-3 py-1 rounded-full border dark:border-[#4FE3C1]/20 self-start sm:self-auto">
              Actual: 18% (Within Target)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06]">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Band 4: Exceeds Expectations (3.75 – 4.49)</span>
              <span className="text-slate-500 dark:text-[#8D96AA] text-[11px]">Recommended target: 30% – 35%</span>
            </div>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-[#8B7CFF] dark:bg-[#8B7CFF]/10 px-3 py-1 rounded-full border dark:border-[#8B7CFF]/20 self-start sm:self-auto">
              Actual: 34% (Within Target)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06]">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Band 3: Meets Expectations (2.75 – 3.74)</span>
              <span className="text-slate-500 dark:text-[#8D96AA] text-[11px]">Recommended target: 40% – 45%</span>
            </div>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-[#8B7CFF] dark:bg-[#8B7CFF]/10 px-3 py-1 rounded-full border dark:border-[#8B7CFF]/20 self-start sm:self-auto">
              Actual: 44% (Within Target)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06]">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Band 2 & 1: Development Needed (&lt; 2.75)</span>
              <span className="text-slate-500 dark:text-[#8D96AA] text-[11px]">Recommended target: 5% – 10%</span>
            </div>
            <span className="font-mono font-bold text-amber-800 bg-amber-50 border-amber-200 dark:text-[#FFB454] dark:bg-[#FFB454]/10 px-3 py-1 rounded-full border dark:border-[#FFB454]/20 self-start sm:self-auto">
              Actual: 4% (Under Target)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

