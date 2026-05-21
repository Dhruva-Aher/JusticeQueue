// Fetches GET /api/cases/queue and exposes { cases, loading, error, refetch }
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import axiosClient from '../lib/axiosClient.js'

export function useCases() {
  const { user, loading: authLoading } = useAuth()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCases = useCallback(async () => {
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

  useEffect(() => {
    // Wait for Firebase auth to finish initialising before making any API call.
    // If we fire before currentUser is set the request goes out without a token,
    // returns 401, and the old redirect interceptor would trigger a full-page
    // reload — creating a dashboard ↔ login infinite loop.
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetchCases()
  }, [authLoading, user, fetchCases])

  return { cases, loading, error, refetch: fetchCases }
}
