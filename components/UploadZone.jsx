'use client'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'

const STAGES = [
  { label: 'Parsing intake file',                    pct: 15 },
  { label: 'Extracting case facts with Gemini AI',   pct: 38 },
  { label: 'Searching similar case precedents',      pct: 60 },
  { label: 'Scoring urgency across all dimensions',  pct: 82 },
  { label: 'Finalizing ranked queue',                pct: 96 },
]

function UploadIcon({ size = 28, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function UploadZone({ status, onUpload, error }) {
  const [stageIdx, setStageIdx]       = useState(0)
  const [acceptedName, setAcceptedName] = useState('')

  useEffect(() => {
    if (status !== 'processing') { setStageIdx(0); return }
    const t = setInterval(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), 2400)
    return () => clearInterval(t)
  }, [status])

  const onDrop = useCallback((accepted) => {
    if (!accepted[0]) return
    setAcceptedName(accepted[0].name)
    onUpload(accepted[0])
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv':        ['.csv'],
      'text/plain':      ['.txt'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: status === 'uploading' || status === 'processing',
  })

  const isProcessing = status === 'uploading' || status === 'processing'
  const isComplete   = status === 'complete'
  const isError      = status === 'error'
  const stage        = STAGES[stageIdx]
  const pct          = isComplete ? 100 : stage?.pct ?? 0

  let borderColor = 'var(--border-mid)'
  if (isDragActive) borderColor = 'var(--accent)'
  if (isComplete)   borderColor = 'var(--clear)'
  if (isError)      borderColor = 'var(--urgent)'

  let bgColor = 'var(--bg-raised)'
  if (isDragActive) bgColor = 'rgba(67,56,202,0.04)'
  if (isProcessing) bgColor = 'var(--bg-surface)'
  if (isComplete)   bgColor = 'rgba(34,201,122,0.04)'

  return (
    <div
      {...getRootProps()}
      style={{
        border: `1px dashed ${borderColor}`,
        background: bgColor,
        borderRadius: 'var(--radius)',
        padding: isProcessing ? '1.5rem 2rem' : '2rem 2.5rem',
        cursor: isProcessing ? 'default' : 'pointer',
        transition: 'border-color 180ms, background 180ms',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <input {...getInputProps()} />

      {/* Animated glow border on drag */}
      {isDragActive && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(67,56,202,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {isProcessing ? (
        /* Processing state */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--accent)', animation: 'pulse 1.2s ease-in-out infinite', flexShrink: 0,
            }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
              {stage.label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', marginLeft: 'auto' }}>
              {pct}%
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: '2px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'var(--accent)',
              borderRadius: '2px',
              width: `${pct}%`,
              transition: 'width 2s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>

          {/* Stage dots */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
            {STAGES.map((_, i) => (
              <div key={i} style={{
                width: i <= stageIdx ? '18px' : '6px', height: '2px',
                borderRadius: '2px',
                background: i <= stageIdx ? 'var(--accent)' : 'var(--border-mid)',
                transition: 'all 400ms ease',
              }} />
            ))}
          </div>
        </div>

      ) : isComplete ? (
        /* Complete state */
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(34,201,122,0.15)', border: '1px solid rgba(34,201,122,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--clear)',
            }}>
              <CheckIcon />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--clear)', fontWeight: 500, marginBottom: '2px' }}>
                Queue scored successfully
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
                {acceptedName || 'File processed'} · Drop a new file to rescore
              </div>
            </div>
          </div>
          <div style={{
            padding: '6px 14px', border: '1px solid var(--border-mid)',
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
            color: 'var(--text-3)',
            borderRadius: 'var(--radius-sm)',
          }}>
            Replace
          </div>
        </div>

      ) : isError ? (
        /* Error state */
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--urgent)', fontWeight: 500, marginBottom: '3px' }}>
              {error || 'Upload failed — please try again'}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
              Accepted formats: CSV · TXT · PDF · Max 10 MB
            </div>
          </div>
          <div style={{
            padding: '6px 14px', border: '1px solid rgba(220,38,38,0.25)',
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
            color: 'var(--urgent)',
            borderRadius: 'var(--radius-sm)', background: 'rgba(220,38,38,0.06)',
          }}>
            Retry
          </div>
        </div>

      ) : (
        /* Default / drag state */
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: 'var(--radius)',
            background: isDragActive ? 'rgba(67,56,202,0.10)' : 'var(--bg-hover)',
            border: `1px solid ${isDragActive ? 'rgba(67,56,202,0.35)' : 'var(--border-mid)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isDragActive ? 'var(--accent)' : 'var(--text-3)',
            flexShrink: 0, transition: 'all 180ms',
          }}>
            <UploadIcon size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: isDragActive ? 'var(--accent)' : 'var(--text)', fontWeight: 500, marginBottom: '4px' }}>
              {isDragActive ? 'Release to analyze' : 'Upload intake batch'}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>
              Drag and drop a client intake file, or click to browse.{' '}
              <span style={{ color: 'var(--text-3)' }}>CSV · TXT · PDF · Max 10 MB</span>
            </div>
          </div>
          <div style={{
            flexShrink: 0, padding: '7px 16px',
            background: isDragActive ? 'var(--accent)' : 'transparent',
            border: `1px solid ${isDragActive ? 'var(--accent)' : 'var(--border-mid)'}`,
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
            color: isDragActive ? '#fff' : 'var(--text-3)',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 180ms',
            pointerEvents: 'none',
          }}>
            Browse
          </div>
        </div>
      )}
    </div>
  )
}
