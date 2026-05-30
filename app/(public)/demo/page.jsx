'use client'
export const dynamic = 'force-dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/judge') }, [router])
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>Loading demo…</span>
    </div>
  )
}
