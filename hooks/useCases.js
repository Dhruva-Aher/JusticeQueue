// Fetches GET /api/cases/queue and exposes { cases, loading, error, refetch }
'use client'
import { useState, useEffect, useCallback } from 'react'
import axiosClient from '../lib/axiosClient.js'

export function useCases() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await axiosClient.get('/api/cases/queue')
      setCases(res.data.cases || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { cases, loading, error, refetch: fetch }
}
