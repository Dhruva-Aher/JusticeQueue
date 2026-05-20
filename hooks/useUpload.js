// Upload state machine — idle | uploading | processing | complete | error
'use client'
import { useState } from 'react'
import axiosClient from '../lib/axiosClient.js'

export function useUpload() {
  const [status, setStatus] = useState('idle')
  const [cases, setCases] = useState([])
  const [error, setError] = useState(null)
  const [batchId, setBatchId] = useState(null)

  async function upload(file) {
    setStatus('uploading')
    setError(null)
    setCases([])

    const formData = new FormData()
    formData.append('file', file)

    try {
      setStatus('processing')
      const res = await axiosClient.post('/api/intake/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setCases(res.data.cases || [])
      setBatchId(res.data.batch_id || null)
      setStatus('complete')
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setCases([])
    setError(null)
    setBatchId(null)
  }

  return { status, cases, error, batchId, upload, reset }
}
