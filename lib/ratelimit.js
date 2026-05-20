// Upstash rate limiter — rateLimitUpload(uid) → { success: boolean }
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let ratelimit

function getRatelimit() {
  if (ratelimit) return ratelimit

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    analytics: false,
  })

  return ratelimit
}

export async function rateLimitUpload(uid) {
  const limiter = getRatelimit()
  const { success } = await limiter.limit(`upload:${uid}`)
  return { success }
}
