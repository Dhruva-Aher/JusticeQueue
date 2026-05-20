// react-dropzone file upload area — accepts CSV, TXT, PDF up to 10MB
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'

const PROCESSING_STAGES = ['PARSING FILE...', 'EXTRACTING FACTS...', 'SCORING URGENCY...', 'FINALIZING...']

export default function UploadZone({ status, onUpload, error }) {
  const [stageIdx, setStageIdx] = useState(0)

  useEffect(() => {
    if (status !== 'processing') { setStageIdx(0); return }
    const t = setInterval(() => setStageIdx((i) => (i + 1) % PROCESSING_STAGES.length), 1500)
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
  const isError = status === 'error'

  const borderColor = isError ? 'var(--stamp)' : isDragActive ? 'var(--stamp)' : 'var(--border-dark)'
  const bg = isProcessing ? 'var(--bg-raised)' : 'var(--bg-inset)'

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: `1px dashed ${borderColor}`,
          background: bg,
          padding: '2.5rem',
          textAlign: 'center',
          cursor: isProcessing ? 'default' : 'pointer',
          transition: 'border-color 120ms ease',
          userSelect: 'none',
        }}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-2)', letterSpacing: '0.04em' }}>
            {PROCESSING_STAGES[stageIdx]}
          </p>
        ) : isError ? (
          <>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--stamp)', letterSpacing: '0.04em' }}>
              {error || 'UPLOAD FAILED'}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)', marginTop: '0.5rem' }}>
              CLICK OR DROP TO TRY AGAIN
            </p>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: isDragActive ? 'var(--stamp)' : 'var(--ink-2)', letterSpacing: '0.04em' }}>
              DROP INTAKE FILE OR CLICK TO BROWSE
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)', marginTop: '0.5rem', letterSpacing: '0.04em' }}>
              CSV · TXT · PDF · MAX 10MB
            </p>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: '2px', background: 'var(--bg-raised)', overflow: 'hidden' }}>
        {isProcessing && (
          <div
            style={{
              height: '100%',
              width: '40%',
              background: 'var(--stamp)',
              animation: 'progress-slide 1.2s ease-in-out infinite',
            }}
          />
        )}
        {status === 'complete' && (
          <div style={{ height: '100%', width: '100%', background: 'var(--forest)' }} />
        )}
      </div>
    </div>
  )
}
