// Upload state machine — idle | uploading | processing | complete | error
'use client'
import { useState } from 'react'
import { getFirebaseAuth } from '../lib/firebase.js'
import axiosClient from '../lib/axiosClient.js'

export function useUpload() {
  const [status,  setStatus]  = useState('idle')
  const [stage,   setStage]   = useState(null)
  const [cases,   setCases]   = useState([])
  const [stats,   setStats]   = useState(null)
  const [error,   setError]   = useState(null)
  const [batchId, setBatchId] = useState(null)

  async function upload(file) {
    setStatus('uploading')
    setStage('uploading')
    setError(null)
    setCases([])
    setStats(null)

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

      setCases(res.data.cases || [])
      setBatchId(res.data.batch_id || null)
      setStats(res.data.stats || null)
      setStage(null)
      setStatus('complete')
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed'
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
    setError(null)
    setBatchId(null)
  }

  return { status, stage, cases, stats, error, batchId, upload, reset }
}
