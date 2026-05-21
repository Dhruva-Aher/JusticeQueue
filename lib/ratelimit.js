// Upstash rate limiter — gracefully disabled when env vars are not configured
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let ratelimit = null

function getRatelimit() {
  if (ratelimit) return ratelimit

  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null   // not configured — caller should skip limiting

  const redis = new Redis({ url, token })

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    analytics: false,
  })

  return ratelimit
}

export async function rateLimitUpload(uid) {
  try {
    const limiter = getRatelimit()
    if (!limiter) return { success: true }   // Redis not configured → allow through

    const { success } = await limiter.limit(`upload:${uid}`)
    return { success }
  } catch {
    // Any Redis / network error → fail open so the upload still works
    return { success: true }
  }
}
