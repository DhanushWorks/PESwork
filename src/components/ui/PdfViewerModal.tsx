import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  CheckCircle2,
  Server,
  Database,
  Zap,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react'

export type PdfViewerModalProps = {
  isOpen: boolean
  onClose: () => void
  fileName: string
  title?: string
  authorName?: string
  goalTitle?: string
  fileUrl?: string
  onDelete?: () => void
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  fileName,
  title,
  authorName = 'Deepak',
  goalTitle = 'Reduce average API response time by 20% by October 31, 2026',
  fileUrl,
  onDelete,
}) => {
  const cleanFileUrl = fileUrl ? fileUrl.split('#name=')[0] : undefined
  const [currentPage, setCurrentPage] = useState<1 | 2>(1)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0)
  const [viewMode, setViewMode] = useState<'dark' | 'paper'>(() => {
    try {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'paper'
    } catch {
      return 'dark'
    }
  })

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.7, Math.round((z - 0.1) * 10) / 10))
  const handleResetZoom = () => setZoomLevel(1.0)

  // Generate self-contained printable document HTML
  const getPrintableHtml = () => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${fileName} - Evidence Audit Report</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
        .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        .logo { font-size: 18px; font-weight: 800; letter-spacing: -0.03em; color: #1e1b4b; }
        .badge { background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; font-family: var(--font-sans); }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
        .meta-item { font-size: 11px; color: #64748b; }
        .meta-value { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; }
        .stat-num { font-size: 26px; font-weight: 800; color: #1e1b4b; margin: 4px 0; }
        .stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
        .highlight-stat { background: #f0fdf4; border-color: #86efac; }
        .highlight-stat .stat-num { color: #15803d; }
        .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #475569; border: 1px solid #cbd5e1; }
        td { padding: 8px 10px; border: 1px solid #cbd5e1; }
        .footer { margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; font-family: var(--font-sans); }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">PERFORMIQ SYSTEMS</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Engineering Performance & Telemetry Labs</div>
        </div>
        <div style="text-align: right;">
          <span class="badge">Official PDF Evidence</span>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px; font-family: var(--font-sans);">REF: #APM-2026-9042</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">SUBMITTING EMPLOYEE<div class="meta-value">${authorName} (FullStack Developer)</div></div>
        <div class="meta-item">TARGET GOAL<div class="meta-value">${goalTitle}</div></div>
        <div class="meta-item">EVIDENCE FILENAME<div class="meta-value">${fileName}</div></div>
        <div class="meta-item">VERIFICATION ENGINE<div class="meta-value">Datadog APM & Grafana Synthetics (Pass)</div></div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Baseline Latency</div>
          <div class="stat-num">412 ms</div>
          <div style="font-size: 11px; color: #64748b;">August 2026 (p50: 380ms)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Current Latency</div>
          <div class="stat-num">268 ms</div>
          <div style="font-size: 11px; color: #64748b;">October 2026 (p50: 245ms)</div>
        </div>
        <div class="stat-card highlight-stat">
          <div class="stat-label">Total Reduction</div>
          <div class="stat-num">-34.9%</div>
          <div style="font-size: 11px; color: #166534; font-weight: 700;">Target: -20% (Exceeded)</div>
        </div>
      </div>

      <div class="section-title">Architectural Optimizations Verified</div>
      <div style="margin-bottom: 8px;"><strong>1. Redis Multi-Tenant Cache Tier:</strong> Cached high-frequency cycle roster queries. Cache hit ratio verified at 94.2%.</div>
      <div style="margin-bottom: 8px;"><strong>2. Database Index & Query Optimization:</strong> Removed nested joins and un-indexed foreign key queries on appraisal history. Query execution time reduced from 184ms to 52ms (-71.7%).</div>
      <div style="margin-bottom: 8px;"><strong>3. HTTP/2 Brotli Payload Compression:</strong> Compressed large evaluation JSON payloads reducing bandwidth footprint from 340KB down to 42KB per request.</div>

      <div class="section-title">Endpoint Benchmark Telemetry</div>
      <table>
        <thead>
          <tr>
            <th>Endpoint URI</th>
            <th>Baseline (Aug)</th>
            <th>Current (Oct)</th>
            <th>p95 Latency</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>GET /api/v1/cycles/active</td>
            <td>340 ms</td>
            <td>180 ms (-47.1%)</td>
            <td>290 ms</td>
            <td><strong style="color: #15803d;">Healthy</strong></td>
          </tr>
          <tr>
            <td>GET /api/v1/reviews/team</td>
            <td>580 ms</td>
            <td>310 ms (-46.6%)</td>
            <td>460 ms</td>
            <td><strong style="color: #15803d;">Healthy</strong></td>
          </tr>
          <tr>
            <td>POST /api/v1/goals/progress</td>
            <td>290 ms</td>
            <td>210 ms (-27.6%)</td>
            <td>320 ms</td>
            <td><strong style="color: #15803d;">Healthy</strong></td>
          </tr>
          <tr>
            <td>GET /api/v1/analytics/calibration</td>
            <td>890 ms</td>
            <td>490 ms (-44.9%)</td>
            <td>710 ms</td>
            <td><strong style="color: #15803d;">Healthy</strong></td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <div>DIGITAL SIGNATURE: SHA256:9b2d8e417a80f0c3d41e7b89aa02919283748281</div>
        <div>VERIFIED BY SRE INFRASTRUCTURE · PAGE 1 OF 1</div>
      </div>
    </body>
    </html>
  `

  // Handle Print Action (Standard browser Print-to-PDF)
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=750')
    if (printWindow) {
      printWindow.document.write(getPrintableHtml())
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 300)
    }
  }

  // Handle Download Action (Creates downloadable file)
  const handleDownload = () => {
    if (cleanFileUrl) {
      const link = document.createElement('a')
      link.href = cleanFileUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }

    const blob = new Blob([getPrintableHtml()], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Handle Open in New Tab
  const handleOpenNewTab = () => {
    if (cleanFileUrl) {
      window.open(cleanFileUrl, '_blank')
      return
    }

    const newWindow = window.open('', '_blank')
    if (newWindow) {
      newWindow.document.write(getPrintableHtml())
      newWindow.document.close()
    }
  }

  const isDarkMode = viewMode === 'dark'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`PDF Viewer - ${fileName}`}
        className="w-full max-w-5xl h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100"
      >
        {/* Top Action Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
          {/* File Name & Badges */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold font-sans text-[11px] shrink-0">
              PDF
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-md">
                  {fileName}
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-slate-200 text-[10px] font-sans">
                  <ShieldCheck className="w-3 h-3" />
                  Verified Evidence
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Submitted by <span className="text-slate-200 font-medium">{authorName}</span> · Goal Artifact
              </p>
            </div>
          </div>

          {/* Center Navigation & Zoom Controls */}
          <div className="hidden md:flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
            {/* Page Controls */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                title="Page 1"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-sans text-slate-300 px-1">
                {currentPage} / 2
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(2)}
                disabled={currentPage === 2}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                title="Page 2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5 pl-1">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="text-xs font-sans text-slate-400 hover:text-white cursor-pointer px-1"
                title="Reset Zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Action Icons & Theme Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Dark Mode / Paper White View Toggle Button */}
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === 'dark' ? 'paper' : 'dark'))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs transition-colors cursor-pointer border border-slate-700"
              title={isDarkMode ? 'Switch to Paper White View' : 'Switch to Dark Mode View'}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Paper View</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Dark View</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenNewTab}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Open in new window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Print / Save to PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer border border-rose-900/40"
                title="Remove attached evidence file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Page Switcher Pill */}
        <div className="flex md:hidden items-center justify-between px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 text-xs">
          <span className="text-slate-400 font-sans">Page {currentPage} of 2</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              className={`px-2.5 py-1 rounded text-xs font-semibold ${
                currentPage === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Page 1
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(2)}
              className={`px-2.5 py-1 rounded text-xs font-semibold ${
                currentPage === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Page 2
            </button>
          </div>
        </div>

        {/* Document Viewing Canvas (A4 Sheet Simulation or Uploaded File) */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-950/95 p-3 sm:p-8 flex justify-center items-start">
          {cleanFileUrl ? (
            <div className="w-full max-w-4xl h-full min-h-[70vh] flex flex-col items-center justify-center p-1 sm:p-2">
              {fileName.toLowerCase().endsWith('.png') ||
              fileName.toLowerCase().endsWith('.jpg') ||
              fileName.toLowerCase().endsWith('.jpeg') ||
              fileName.toLowerCase().endsWith('.webp') ||
              cleanFileUrl.startsWith('data:image/') ? (
                <img
                  src={cleanFileUrl}
                  alt={fileName}
                  className="max-w-full max-h-[76vh] object-contain rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
                />
              ) : (
                <iframe
                  src={cleanFileUrl}
                  title={fileName}
                  className="w-full h-[76vh] rounded-xl border border-slate-700/80 bg-white shadow-2xl"
                />
              )}
            </div>
          ) : (
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className={`w-full max-w-[760px] rounded-xl shadow-2xl p-6 sm:p-12 border select-text my-2 transition-colors duration-200 ${
                isDarkMode
                  ? 'bg-[#121217] text-zinc-100 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]'
                  : 'bg-white text-slate-900 border-slate-300 shadow-xl pdf-viewer-sheet-paper'
              }`}
            >
            {currentPage === 1 ? (
              /* ================= PAGE 1 ================= */
              <div className="space-y-6">
                {/* Official Letterhead */}
                <div
                  className={`flex items-start justify-between pb-4 border-b-2 ${
                    isDarkMode ? 'border-white/20' : 'border-slate-900'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center font-black text-xs font-sans text-white ${
                          isDarkMode ? 'bg-indigo-600 shadow-sm' : 'bg-indigo-900'
                        }`}
                      >
                        P
                      </div>
                      <h1
                        className={`text-base font-black tracking-tight uppercase font-sans ${
                          isDarkMode
                            ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                            : 'text-indigo-950'
                        }`}
                      >
                        PERFORMIQ SYSTEMS
                      </h1>
                    </div>
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wider mt-0.5 ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      Engineering Telemetry & Performance Lab
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-sans font-bold uppercase tracking-wider ${
                        isDarkMode
                          ? 'bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shadow-2xs'
                          : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                      }`}
                    >
                      Official Appraisal Evidence
                    </span>
                    <p
                      className={`text-[10px] font-sans mt-1 ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      DOC-REF: APM-2026-9042
                    </p>
                  </div>
                </div>

                {/* Document Title & Meta Box */}
                <div>
                  <h2
                    className={`text-xl font-bold tracking-tight ${
                      isDarkMode
                        ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                        : 'text-slate-950'
                    }`}
                  >
                    {title || 'Metric Telemetry & API Latency Verification Snapshot'}
                  </h2>
                  <p
                    className={`text-xs mt-1 ${
                      isDarkMode ? 'text-zinc-300' : 'text-slate-500'
                    }`}
                  >
                    Formal quantitative milestone report submitted for FY26 Performance Appraisal.
                  </p>
                </div>

                {/* 4-Column Metadata Grid */}
                <div
                  className={`grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl text-xs border ${
                    isDarkMode
                      ? 'bg-white/[0.04] border-white/10'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <span
                      className={`text-[10px] uppercase font-bold block font-sans ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      Author
                    </span>
                    <span
                      className={`font-semibold ${
                        isDarkMode ? 'text-white font-bold' : 'text-slate-900'
                      }`}
                    >
                      {authorName}
                    </span>
                    <span
                      className={`text-[10px] block ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      FullStack Developer
                    </span>
                  </div>
                  <div>
                    <span
                      className={`text-[10px] uppercase font-bold block font-sans ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      Target Metric
                    </span>
                    <span
                      className={`font-semibold ${
                        isDarkMode ? 'text-white font-bold' : 'text-slate-900'
                      }`}
                    >
                      API Response Time
                    </span>
                    <span
                      className={`text-[10px] block ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      Goal 1 (50% wt)
                    </span>
                  </div>
                  <div>
                    <span
                      className={`text-[10px] uppercase font-bold block font-sans ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      Target Threshold
                    </span>
                    <span
                      className={`font-semibold ${
                        isDarkMode ? 'text-white font-bold' : 'text-slate-900'
                      }`}
                    >
                      -20% Reduction
                    </span>
                    <span
                      className={`text-[10px] block ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      329 ms target
                    </span>
                  </div>
                  <div>
                    <span
                      className={`text-[10px] uppercase font-bold block font-sans ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      Verification
                    </span>
                    <span
                      className={`font-semibold flex items-center gap-1 ${
                        isDarkMode ? 'text-zinc-100 font-bold' : 'text-slate-900 font-bold'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Datadog APM
                    </span>
                    <span
                      className={`text-[10px] block ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      Trace #88f9a0c1
                    </span>
                  </div>
                </div>

                {/* Key Executive KPI Highlights */}
                <div className="grid grid-cols-3 gap-3">
                  <div
                    className={`p-3.5 rounded-xl border text-center shadow-2xs ${
                      isDarkMode
                        ? 'border-white/10 bg-white/[0.03]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase font-sans ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      Baseline (Aug 1)
                    </span>
                    <div
                      className={`text-2xl font-black mt-1 font-sans ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}
                    >
                      412{' '}
                      <span
                        className={`text-xs font-normal ${
                          isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                        }`}
                      >
                        ms
                      </span>
                    </div>
                    <span
                      className={`text-[10px] ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      p95: 1,120 ms
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border text-center shadow-2xs ${
                      isDarkMode
                        ? 'border-indigo-500/30 bg-indigo-950/25'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase font-sans ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-400'
                      }`}
                    >
                      Current (Oct 18)
                    </span>
                    <div
                      className={`text-2xl font-black mt-1 font-sans ${
                        isDarkMode ? 'text-[#8B7CFF]' : 'text-indigo-700'
                      }`}
                    >
                      268{' '}
                      <span
                        className={`text-xs font-normal ${
                          isDarkMode ? 'text-indigo-300' : 'text-indigo-500'
                        }`}
                      >
                        ms
                      </span>
                    </div>
                    <span
                      className={`text-[10px] ${
                        isDarkMode ? 'text-indigo-300/80' : 'text-slate-400'
                      }`}
                    >
                      p95: 640 ms
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border text-center shadow-2xs ${
                      isDarkMode
                        ? 'border-zinc-700 bg-zinc-850'
                        : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase font-sans flex items-center justify-center gap-1 ${
                        isDarkMode ? 'text-zinc-200' : 'text-slate-800'
                      }`}
                    >
                      <TrendingDown className="w-3 h-3" /> Net Reduction
                    </span>
                    <div
                      className={`text-2xl font-black mt-1 font-sans ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      -34.9%
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-600'
                      }`}
                    >
                      Target Exceeded (+14.9%)
                    </span>
                  </div>
                </div>

                {/* High-Resolution Latency Chart (SVG) */}
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    isDarkMode
                      ? 'border-white/10 bg-white/[0.03]'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between text-xs font-bold ${
                      isDarkMode ? 'text-zinc-200' : 'text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 uppercase font-sans text-[11px]">
                      <Zap
                        className={`w-3.5 h-3.5 ${
                          isDarkMode ? 'text-[#8B7CFF]' : 'text-indigo-600'
                        }`}
                      />
                      8-Week Latency Progression (ms)
                    </span>
                    <span
                      className={`text-[11px] font-normal ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      Goal Target:{' '}
                      <span className="font-semibold text-rose-500 font-sans">
                        329 ms
                      </span>
                    </span>
                  </div>

                  <svg viewBox="0 0 640 180" className="w-full h-40 overflow-visible">
                    {/* Background grid lines */}
                    <line
                      x1="40"
                      y1="20"
                      x2="620"
                      y2="20"
                      stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : '#cbd5e1'}
                      strokeDasharray="3 3"
                    />
                    <text
                      x="32"
                      y="24"
                      fontSize="9"
                      fill={isDarkMode ? '#94a3b8' : '#94a3b8'}
                      textAnchor="end"
                      fontFamily="var(--font-sans)"
                    >
                      450ms
                    </text>

                    <line
                      x1="40"
                      y1="60"
                      x2="620"
                      y2="60"
                      stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : '#cbd5e1'}
                      strokeDasharray="3 3"
                    />
                    <text
                      x="32"
                      y="64"
                      fontSize="9"
                      fill={isDarkMode ? '#94a3b8' : '#94a3b8'}
                      textAnchor="end"
                      fontFamily="var(--font-sans)"
                    >
                      375ms
                    </text>

                    {/* Target line: 329ms (around y=85) */}
                    <line
                      x1="40"
                      y1="85"
                      x2="620"
                      y2="85"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                    <text
                      x="620"
                      y="80"
                      fontSize="9"
                      fill={isDarkMode ? '#fb7185' : '#e11d48'}
                      textAnchor="end"
                      fontWeight="bold"
                      fontFamily="var(--font-sans)"
                    >
                      TARGET THRESHOLD (-20%): 329ms
                    </text>

                    <line
                      x1="40"
                      y1="120"
                      x2="620"
                      y2="120"
                      stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : '#cbd5e1'}
                      strokeDasharray="3 3"
                    />
                    <text
                      x="32"
                      y="124"
                      fontSize="9"
                      fill={isDarkMode ? '#94a3b8' : '#94a3b8'}
                      textAnchor="end"
                      fontFamily="var(--font-sans)"
                    >
                      300ms
                    </text>

                    <line
                      x1="40"
                      y1="150"
                      x2="620"
                      y2="150"
                      stroke={isDarkMode ? 'rgba(255,255,255,0.15)' : '#94a3b8'}
                    />
                    <text
                      x="32"
                      y="154"
                      fontSize="9"
                      fill={isDarkMode ? '#94a3b8' : '#94a3b8'}
                      textAnchor="end"
                      fontFamily="var(--font-sans)"
                    >
                      250ms
                    </text>

                    {/* Area under curve */}
                    <polygon
                      points="40,38 120,52 200,68 280,80 360,98 440,118 520,132 600,140 600,150 40,150"
                      fill={isDarkMode ? '#8B7CFF' : '#e0e7ff'}
                      fillOpacity={isDarkMode ? '0.2' : '0.5'}
                    />

                    {/* Trend line */}
                    <polyline
                      points="40,38 120,52 200,68 280,80 360,98 440,118 520,132 600,140"
                      fill="none"
                      stroke={isDarkMode ? '#8B7CFF' : '#4f46e5'}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Data dots */}
                    {[
                      { x: 40, y: 38, val: '412ms', w: 'W1' },
                      { x: 120, y: 52, val: '395ms', w: 'W2' },
                      { x: 200, y: 68, val: '370ms', w: 'W3' },
                      { x: 280, y: 80, val: '345ms', w: 'W4' },
                      { x: 360, y: 98, val: '315ms', w: 'W5' },
                      { x: 440, y: 118, val: '295ms', w: 'W6' },
                      { x: 520, y: 132, val: '280ms', w: 'W7' },
                      { x: 600, y: 140, val: '268ms', w: 'W8' },
                    ].map((pt) => (
                      <g key={pt.w}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="4.5"
                          fill={isDarkMode ? '#18181b' : '#ffffff'}
                          stroke={isDarkMode ? '#8B7CFF' : '#4f46e5'}
                          strokeWidth="2.5"
                        />
                        <text
                          x={pt.x}
                          y="165"
                          fontSize="9"
                          fill={isDarkMode ? '#a1a1aa' : '#64748b'}
                          textAnchor="middle"
                          fontFamily="var(--font-sans)"
                        >
                          {pt.w}
                        </text>
                      </g>
                    ))}

                    {/* Callout badge on final data point */}
                    <rect x="545" y="112" width="68" height="18" rx="4" fill="#15803d" />
                    <text
                      x="579"
                      y="124"
                      fontSize="9"
                      fill="#ffffff"
                      textAnchor="middle"
                      fontWeight="bold"
                      fontFamily="var(--font-sans)"
                    >
                      268ms (-35%)
                    </text>
                  </svg>
                </div>

                {/* Technical Optimizations Section */}
                <div>
                  <h3
                    className={`text-xs font-bold uppercase tracking-wider pb-1.5 border-b font-sans ${
                      isDarkMode
                        ? 'text-zinc-200 border-white/10'
                        : 'text-slate-800 border-slate-200'
                    }`}
                  >
                    Architectural Optimizations Verified
                  </h3>
                  <div className="mt-3 space-y-2 text-xs">
                    <div
                      className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                        isDarkMode
                          ? 'border-white/10 bg-white/[0.03]'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                          isDarkMode
                            ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span
                          className={`font-bold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          Redis In-Memory Distributed Caching Layer
                        </span>
                        <p
                          className={`text-[11px] mt-0.5 ${
                            isDarkMode ? 'text-zinc-300' : 'text-slate-600'
                          }`}
                        >
                          Implemented redis cache on cycle metadata and roster lookups. Cache hit ratio verified at{' '}
                          <strong
                            className={
                              isDarkMode
                                ? 'text-white font-semibold'
                                : 'text-slate-900 font-semibold'
                            }
                          >
                            94.2%
                          </strong>
                          , removing redundant database roundtrips.
                        </p>
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                        isDarkMode
                          ? 'border-white/10 bg-white/[0.03]'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                          isDarkMode
                            ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        }`}
                      >
                        <Server className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span
                          className={`font-bold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          Database Indexing & Query Plan Optimization
                        </span>
                        <p
                          className={`text-[11px] mt-0.5 ${
                            isDarkMode ? 'text-zinc-300' : 'text-slate-600'
                          }`}
                        >
                          Resolved N+1 query patterns across appraisal review queries. Query execution overhead dropped from{' '}
                          <strong
                            className={
                              isDarkMode
                                ? 'text-white font-semibold'
                                : 'text-slate-900 font-semibold'
                            }
                          >
                            184ms to 52ms (-71.7%)
                          </strong>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Page Footer */}
                <div
                  className={`pt-4 border-t flex items-center justify-between text-[10px] font-sans ${
                    isDarkMode
                      ? 'border-white/10 text-zinc-400'
                      : 'border-slate-200 text-slate-400'
                  }`}
                >
                  <span>CONFIDENTIAL · AUDIT TRAIL ID: 88F9-A0C1-4B2D</span>
                  <span>PAGE 1 OF 2</span>
                </div>
              </div>
            ) : (
              /* ================= PAGE 2 ================= */
              <div className="space-y-6">
                {/* Page 2 Header */}
                <div
                  className={`flex items-start justify-between pb-4 border-b-2 ${
                    isDarkMode ? 'border-white/20' : 'border-slate-900'
                  }`}
                >
                  <div>
                    <h2
                      className={`text-sm font-black tracking-tight uppercase font-sans ${
                        isDarkMode
                          ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                          : 'text-indigo-950'
                      }`}
                    >
                      PERFORMIQ SYSTEMS · ENDPOINT BENCHMARK AUDIT
                    </h2>
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wider mt-0.5 ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      Detailed Micro-Telemetry Breakdown
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[10px] font-sans ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      DOC-REF: APM-2026-9042 · P.2
                    </span>
                  </div>
                </div>

                {/* Table of Measured Endpoints */}
                <div>
                  <h3
                    className={`text-xs font-bold uppercase tracking-wider pb-1.5 border-b font-sans mb-2 ${
                      isDarkMode
                        ? 'text-zinc-200 border-white/10'
                        : 'text-slate-800 border-slate-200'
                    }`}
                  >
                    Primary Production Endpoints (p50 & p95 Measured)
                  </h3>

                  <div
                    className={`border rounded-xl overflow-hidden text-xs ${
                      isDarkMode
                        ? 'border-white/10 bg-white/[0.02]'
                        : 'border-slate-200'
                    }`}
                  >
                    <table className="w-full border-collapse">
                      <thead>
                        <tr
                          className={`font-sans text-[10px] uppercase border-b ${
                            isDarkMode
                              ? 'bg-white/[0.05] text-zinc-300 border-white/10'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <th className="p-2.5 text-left">API Endpoint</th>
                          <th className="p-2.5 text-right">Baseline (Aug)</th>
                          <th className="p-2.5 text-right">Current (Oct)</th>
                          <th className="p-2.5 text-right">p95 Latency</th>
                          <th className="p-2.5 text-right">Reduction</th>
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y font-sans text-[11px] ${
                          isDarkMode ? 'divide-white/10' : 'divide-slate-200'
                        }`}
                      >
                        {[
                          { ep: 'GET /api/v1/cycles/active', base: '340 ms', cur: '180 ms', p95: '290 ms', red: '-47.1%' },
                          { ep: 'GET /api/v1/reviews/team', base: '580 ms', cur: '310 ms', p95: '460 ms', red: '-46.6%' },
                          { ep: 'POST /api/v1/goals/progress', base: '290 ms', cur: '210 ms', p95: '320 ms', red: '-27.6%' },
                          { ep: 'GET /api/v1/analytics/calibration', base: '890 ms', cur: '490 ms', p95: '710 ms', red: '-44.9%' },
                          { ep: 'GET /api/v1/users/profile', base: '190 ms', cur: '95 ms', p95: '160 ms', red: '-50.0%' },
                        ].map((row) => (
                          <tr key={row.ep}>
                            <td
                              className={`p-2.5 font-bold ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {row.ep}
                            </td>
                            <td
                              className={`p-2.5 text-right ${
                                isDarkMode ? 'text-zinc-400' : 'text-slate-500'
                              }`}
                            >
                              {row.base}
                            </td>
                            <td
                              className={`p-2.5 text-right font-bold ${
                                isDarkMode ? 'text-[#8B7CFF]' : 'text-indigo-700'
                              }`}
                            >
                              {row.cur}
                            </td>
                            <td
                              className={`p-2.5 text-right ${
                                isDarkMode ? 'text-zinc-400' : 'text-slate-600'
                              }`}
                            >
                              {row.p95}
                            </td>
                            <td
                              className={`p-2.5 text-right font-bold ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {row.red}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SRE Infrastructure Stability Verification */}
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    isDarkMode
                      ? 'bg-white/[0.03] border-white/10'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between font-bold ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    <span className="font-sans text-[11px] uppercase">
                      Infrastructure Stability Summary
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-sans text-[10px] ${
                        isDarkMode
                          ? 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-300'
                      }`}
                    >
                      Zero Outages Reported
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 font-sans text-[11px]">
                    <div>
                      <span
                        className={`text-[10px] block ${
                          isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                        }`}
                      >
                        ERROR RATE
                      </span>
                      <span
                        className={`font-bold ${
                          isDarkMode ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        0.012% (down from 0.085%)
                      </span>
                    </div>
                    <div>
                      <span
                        className={`text-[10px] block ${
                          isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                        }`}
                      >
                        THROUGHPUT
                      </span>
                      <span
                        className={`font-bold ${
                          isDarkMode ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        1,840 req / sec
                      </span>
                    </div>
                    <div>
                      <span
                        className={`text-[10px] block ${
                          isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                        }`}
                      >
                        AVG CPU LOAD
                      </span>
                      <span
                        className={`font-bold ${
                          isDarkMode ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        44% across 6 pods
                      </span>
                    </div>
                  </div>
                </div>

                {/* Manager Guidance Box */}
                <div
                  className={`p-4 rounded-xl border text-xs space-y-1 ${
                    isDarkMode
                      ? 'bg-indigo-950/40 border-indigo-500/40'
                      : 'bg-indigo-50/70 border-indigo-200'
                  }`}
                >
                  <span
                    className={`font-bold block ${
                      isDarkMode ? 'text-indigo-200' : 'text-indigo-950'
                    }`}
                  >
                    Evaluator Review Guidance
                  </span>
                  <p
                    className={`leading-relaxed text-[11px] ${
                      isDarkMode ? 'text-indigo-100/90' : 'text-indigo-900/80'
                    }`}
                  >
                    This official telemetry snapshot conclusively demonstrates that{' '}
                    {authorName} has exceeded the 20% latency reduction requirement set in Goal 1.{' '}
                    The documented -34.9% net improvement justifies the 65% logged milestone progress and qualifies for Band 4 / Exceeds Expectations rating on technical delivery.
                  </p>
                </div>

                {/* Verification Seal & Signoff */}
                <div
                  className={`pt-6 border-t-2 border-dashed flex items-center justify-between ${
                    isDarkMode ? 'border-white/15' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div
                      className={`text-[10px] font-sans uppercase ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      Automated Pipeline Verification
                    </div>
                    <div
                      className={`text-xs font-bold font-sans ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}
                    >
                      STATUS: VERIFIED & AUDITED
                    </div>
                    <div
                      className={`text-[9px] font-sans ${
                        isDarkMode ? 'text-zinc-400' : 'text-slate-400'
                      }`}
                    >
                      TIMESTAMP: 2026-10-18T14:32:00Z
                    </div>
                  </div>
                  <div
                    className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center text-center p-1 font-bold uppercase rotate-[-8deg] shadow-2xs ${
                      isDarkMode
                        ? 'border-white text-white bg-zinc-850'
                        : 'border-slate-900 text-slate-900 bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 mb-0.5" />
                    <span className="text-[8px] leading-tight font-black">
                      AUDITED EVIDENCE
                    </span>
                    <span className="text-[7px] font-sans">2026</span>
                  </div>
                </div>

                {/* Page 2 Footer */}
                <div
                  className={`pt-4 border-t flex items-center justify-between text-[10px] font-sans ${
                    isDarkMode
                      ? 'border-white/10 text-zinc-400'
                      : 'border-slate-200 text-slate-400'
                  }`}
                >
                  <span>CONFIDENTIAL · AUDIT TRAIL ID: 88F9-A0C1-4B2D</span>
                  <span>PAGE 2 OF 2</span>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
