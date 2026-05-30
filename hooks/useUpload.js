// Upload state machine — idle | uploading | processing | complete | error
'use client'
import { useState } from 'react'
import { getFirebaseAuth } from '../lib/firebase.js'
import axiosClient from '../lib/axiosClient.js'

export function useUpload() {
  const [status,     setStatus]     = useState('idle')
  const [stage,      setStage]      = useState(null)
  const [cases,      setCases]      = useState([])
  const [stats,      setStats]      = useState(null)
  const [agentStats, setAgentStats] = useState(null)
  const [error,      setError]      = useState(null)
  const [batchId,    setBatchId]    = useState(null)

  async function upload(file) {
    const startMs = Date.now()
    setStatus('uploading')
    setStage('uploading')
    setError(null)
    setCases([])
    setStats(null)
    setAgentStats(null)

    try {
      // Get a fresh token directly — don't rely solely on the interceptor
      // because FormData requests can occasionally race with interceptor timing.
      const auth  = getFirebaseAuth()
      const user  = auth?.currentUser
      if (!user) throw new Error('Not signed in')

      const token    = await user.getIdToken(/* forceRefresh */ false)
      const formData = new FormData()
      formData.append('file', file)

      setStage('processing')
      setStatus('processing')

      // Do NOT set Content-Type manually — axios + browser must set it
      // automatically so the multipart boundary is included.
      const res = await axiosClient.post('/api/intake/upload', formData, {
        headers: { Authorization: `Bearer ${token}` },
        // No Content-Type — let the browser attach the correct boundary
      })

      const resStats = res.data.stats || {}
      setCases(res.data.cases || [])
      setBatchId(res.data.batch_id || null)
      setStats(resStats)
      setAgentStats({
        cases_scored:            resStats.processed ?? 0,
        emails_drafted:          resStats.emails_drafted ?? 0,
        calendar_blocks_created: resStats.calendar_blocks_created ?? 0,
        briefs_generated:        resStats.briefs_generated ?? 0,
        duration_ms:             Date.now() - startMs,
      })
      setStage(null)
      setStatus('complete')
    } catch (err) {
      const raw = err.response?.data?.error
             ?? err.response?.data?.message
             ?? err.message
             ?? 'Upload failed'
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw)
      setError(msg)
      setStage(null)
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setStage(null)
    setCases([])
    setStats(null)
    setAgentStats(null)
    setError(null)
    setBatchId(null)
  }

  return { status, stage, cases, stats, agentStats, error, batchId, upload, reset }
}
