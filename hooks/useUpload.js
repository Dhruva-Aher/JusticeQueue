// Upload state machine — idle | uploading | processing | complete | error
'use client'
import { useState } from 'react'
import axiosClient from '../lib/axiosClient.js'

export function useUpload() {
  const [status, setStatus] = useState('idle')
  const [stage, setStage] = useState(null)
  const [cases, setCases] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [batchId, setBatchId] = useState(null)

  async function upload(file) {
    setStatus('uploading')
    setStage('uploading')
    setError(null)
    setCases([])
    setStats(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      setStage('processing')
      setStatus('processing')
      const res = await axiosClient.post('/api/intake/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setCases(res.data.cases || [])
      setBatchId(res.data.batch_id || null)
      setStats(res.data.stats || null)
      setStage(null)
      setStatus('complete')
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed')
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
