// Upstash rate limiter — fail-closed on Redis errors
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

let _redis = null

function getRedis() {
  if (_redis) return _redis
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null   // not configured
  _redis = new Redis({ url, token })
  return _redis
}

function makeLimiter(requests, window) {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), analytics: false })
}

// Cached limiter instances
let _upload   = null
let _override = null
let _email    = null
let _calendar = null
let _clear    = null

async function applyLimit(getLimiter, key) {
  try {
    const limiter = getLimiter()
    if (!limiter) return { success: true }   // Redis not configured — allow
    const { success } = await limiter.limit(key)
    return { success }
  } catch (err) {
    console.error('[ratelimit] Redis error:', err.message)
    return { success: false }   // fail-closed
  }
}

export async function rateLimitUpload(uid) {
  if (!_upload) _upload = makeLimiter(10, '15 m')
  return applyLimit(() => _upload, `upload:${uid}`)
}

export async function rateLimitOverride(uid) {
  if (!_override) _override = makeLimiter(10, '15 m')
  return applyLimit(() => _override, `override:${uid}`)
}

export async function rateLimitEmail(uid) {
  if (!_email) _email = makeLimiter(5, '15 m')
  return applyLimit(() => _email, `email:${uid}`)
}

export async function rateLimitCalendar(uid) {
  if (!_calendar) _calendar = makeLimiter(10, '15 m')
  return applyLimit(() => _calendar, `calendar:${uid}`)
}

export async function rateLimitClear(uid) {
  if (!_clear) _clear = makeLimiter(2, '15 m')
  return applyLimit(() => _clear, `clear:${uid}`)
}
