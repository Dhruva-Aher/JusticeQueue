'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

import { getFirebaseAuth } from '../lib/firebase.js'

export default function ReviewActionPanel({ uid, currentScore, onComplete }) {
  const [isLoading, setIsLoading] = useState(null)
  const [isResolved, setIsResolved] = useState(false)
  
  // Dialog states
  const [showModify, setShowModify] = useState(false)
  const [showEscalate, setShowEscalate] = useState(false)
  const [newScore, setNewScore] = useState(currentScore || '')

  useEffect(() => {
    if (currentScore != null) setNewScore(currentScore)
  }, [currentScore])

  const handleAction = async (action, extraPayload = {}) => {
    setIsLoading(action)
    try {
      const auth = getFirebaseAuth()
      const token = await auth?.currentUser?.getIdToken()
      const res = await fetch(`/api/cases/${uid}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action, ...extraPayload })
      })
      
      if (!res.ok) throw new Error('Request failed')
      
      const data = await res.json()
      
      if (action === 'approve') {
        toast.success("Priority escalation approved — Case moved to Tier 1")
        setIsResolved(true)
        if (onComplete) onComplete(data.updated?.status, data.updated?.priority_score)
      } else if (action === 'modify') {
        toast.success("Priority score updated")
        setShowModify(false)
        if (onComplete) onComplete(data.updated?.status, data.updated?.priority_score)
      } else if (action === 'escalate') {
        toast.success("Case escalated to litigation queue")
        setShowEscalate(false)
        setIsResolved(true)
        if (onComplete) onComplete(data.updated?.status, data.updated?.priority_score)
      } else if (action === 'request_senior_review') {
        toast.success("Senior review requested")
        setIsResolved(true)
        if (onComplete) onComplete(data.updated?.status, data.updated?.priority_score)
      }
    } catch {
      toast.error("Failed to process action")
    } finally {
      setIsLoading(null)
    }
  }

  const Spinner = () => (
    <svg className="animate-spin" style={{ height: '14px', width: '14px', marginRight: '8px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  )

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border)',
      position: 'sticky',
      top: '1.5rem',
      padding: '16px',
      marginBottom: '1.25rem'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Review Action Required
        </h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button 
          onClick={() => handleAction('approve')}
          disabled={isLoading || isResolved}
          style={{
            width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--text)', color: 'white',
            fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
            borderRadius: 'var(--radius-sm)', border: 'none',
            boxShadow: 'var(--shadow-sm)', transition: 'background 150ms', cursor: (isLoading || isResolved) ? 'not-allowed' : 'pointer',
            opacity: (isLoading || isResolved) ? 0.7 : 1
          }}
          onMouseEnter={(e) => !isResolved && (e.currentTarget.style.background = '#000')}
          onMouseLeave={(e) => !isResolved && (e.currentTarget.style.background = 'var(--text)')}>
          {isLoading === 'approve' && <Spinner />}
          Approve Priority Escalation
        </button>

        <button 
          onClick={() => setShowModify(true)}
          disabled={isLoading || isResolved}
          style={{
            width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-surface)', color: 'var(--text-2)',
            fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-mid)',
            transition: 'background 150ms', cursor: (isLoading || isResolved) ? 'not-allowed' : 'pointer',
            opacity: (isLoading || isResolved) ? 0.7 : 1
          }}
          onMouseEnter={(e) => !isResolved && (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => !isResolved && (e.currentTarget.style.background = 'var(--bg-surface)')}>
          {isLoading === 'modify' && <Spinner />}
          Modify Priority Score
        </button>

        <div style={{ paddingTop: '16px', marginTop: '8px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => setShowEscalate(true)}
            disabled={isLoading || isResolved}
            style={{
              width: '100%', background: 'none', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
              border: 'none', textAlign: 'center', transition: 'color 150ms', cursor: (isLoading || isResolved) ? 'not-allowed' : 'pointer',
              padding: '8px 0', opacity: (isLoading || isResolved) ? 0.7 : 1
            }}
            onMouseEnter={(e) => !isResolved && (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => !isResolved && (e.currentTarget.style.color = 'var(--text-2)')}>
            {isLoading === 'escalate' && <Spinner />}
            Escalate to Litigation
          </button>
          
          <button 
            onClick={() => handleAction('request_senior_review')}
            disabled={isLoading || isResolved}
            style={{
              width: '100%', background: 'none', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
              border: 'none', textAlign: 'center', transition: 'color 150ms', cursor: (isLoading || isResolved) ? 'not-allowed' : 'pointer',
              padding: '8px 0', opacity: (isLoading || isResolved) ? 0.7 : 1
            }}
            onMouseEnter={(e) => !isResolved && (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => !isResolved && (e.currentTarget.style.color = 'var(--text-2)')}>
            {isLoading === 'request_senior_review' && <Spinner />}
            Request Senior Review
          </button>
        </div>
      </div>

      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)',
        textAlign: 'center', marginTop: '16px', lineHeight: 1.4
      }}>
        Actions logged to case record
      </p>

      {/* Modify Score Dialog */}
      {showModify && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', flexDirection: 'column', padding: '24px', zIndex: 50, borderRadius: 'var(--radius)' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Modify Priority Score</h4>
          <input 
            type="number" 
            min="1" max="100" 
            value={newScore} 
            onChange={e => setNewScore(e.target.value)}
            placeholder="New Score (1-100)"
            style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '16px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowModify(false)} style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', background: 'transparent', borderRadius: '4px' }}>Cancel</button>
            <button 
              onClick={() => handleAction('modify', { new_score: newScore })}
              style={{ flex: 1, padding: '8px', background: 'var(--text)', color: 'white', border: 'none', borderRadius: '4px' }}>
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Escalate Dialog */}
      {showEscalate && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', flexDirection: 'column', padding: '24px', zIndex: 50, borderRadius: 'var(--radius)', justifyContent: 'center' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>Escalate this case to the litigation team?</h4>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={() => setShowEscalate(false)} style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', background: 'transparent', borderRadius: '4px' }}>Cancel</button>
            <button 
              onClick={() => handleAction('escalate')}
              style={{ flex: 1, padding: '8px', background: 'var(--urgent)', color: 'white', border: 'none', borderRadius: '4px' }}>
              Escalate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
