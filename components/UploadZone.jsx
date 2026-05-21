'use client'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'

const STAGES = [
  { label: 'Parsing file', pct: 15 },
  { label: 'Extracting facts with Gemini', pct: 40 },
  { label: 'Searching similar cases', pct: 65 },
  { label: 'Scoring urgency', pct: 85 },
  { label: 'Finalizing queue', pct: 95 },
]

export default function UploadZone({ status, onUpload, error }) {
  const [stageIdx, setStageIdx] = useState(0)

  useEffect(() => {
    if (status !== 'processing') { setStageIdx(0); return }
    const t = setInterval(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), 2200)
    return () => clearInterval(t)
  }, [status])

  const onDrop = useCallback(
    (accepted) => { if (accepted[0]) onUpload(accepted[0]) },
    [onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: status === 'uploading' || status === 'processing',
  })

  const isProcessing = status === 'uploading' || status === 'processing'
  const isComplete   = status === 'complete'
  const isError      = status === 'error'

  const stage = STAGES[stageIdx]

  return (
    <div style={{ position: 'relative' }}>
      <div
        {...getRootProps()}
        style={{
          border: `1px solid ${isDragActive ? 'var(--gold)' : isError ? 'var(--urgent)' : isComplete ? 'var(--clear)' : 'var(--border-mid)'}`,
          background: isDragActive
            ? 'var(--gold-subtle)'
            : isProcessing
            ? 'var(--bg-surface)'
            : 'var(--bg-raised)',
          padding: '2rem 2.5rem',
          cursor: isProcessing ? 'default' : 'pointer',
          transition: 'border-color 150ms, background 150ms',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1.5rem',
          userSelect: 'none',
        }}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 1.2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                {stage.label}
              </span>
            </div>
            <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--gold)',
                borderRadius: '1px',
                width: `${stage.pct}%`,
                transition: 'width 1.8s cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
          </div>
        ) : isComplete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--clear)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--clear)', fontWeight: 500 }}>
              Queue scored — drop a new file to rescore
            </span>
          </div>
        ) : isError ? (
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--urgent)', fontWeight: 500, marginBottom: '2px' }}>
              {error || 'Upload failed'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.03em' }}>
              Click or drop to try again
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: isDragActive ? 'var(--gold)' : 'var(--text)', fontWeight: 500, marginBottom: '4px' }}>
              {isDragActive ? 'Drop to analyze' : 'Upload intake file'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.03em' }}>
              CSV · TXT · PDF · Max 10 MB
            </div>
          </div>
        )}

        {!isProcessing && !isError && (
          <div style={{
            flexShrink: 0, padding: '8px 18px',
            background: isDragActive ? 'var(--gold)' : 'transparent',
            border: `1px solid ${isDragActive ? 'var(--gold)' : 'var(--border-mid)'}`,
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            color: isDragActive ? '#000' : 'var(--text-3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            transition: 'all 150ms',
            pointerEvents: 'none',
          }}>
            {isComplete ? 'Replace' : 'Browse'}
          </div>
        )}
      </div>
    </div>
  )
}
