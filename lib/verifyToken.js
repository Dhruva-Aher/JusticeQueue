// Firebase ID token verification — no Admin SDK, no env vars required.
// Uses Firebase's public X.509 certificate endpoint and Node.js built-in crypto.
import { createPublicKey, createVerify } from 'crypto'

const FIREBASE_PROJECT_ID = 'justicequeue'
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

// In-memory cert cache (survives within a single serverless invocation lifetime)
let cachedCerts   = null
let certsExpiresAt = 0

async function getPublicCerts() {
  if (cachedCerts && Date.now() < certsExpiresAt) return cachedCerts

  const res  = await fetch(CERTS_URL)
  const data = await res.json()

  // Respect Cache-Control max-age from Google's response
  const cc     = res.headers.get('cache-control') || ''
  const maxAge = parseInt(cc.match(/max-age=(\d+)/)?.[1] ?? '3600', 10)

  cachedCerts    = data          // { kid: '-----BEGIN CERTIFICATE-----\n…' }
  certsExpiresAt = Date.now() + maxAge * 1000
  return cachedCerts
}

function b64url(s) {
  // base64url → Buffer
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

export async function verifyToken(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (!token) throw new Error('Missing authorization token')

  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed JWT')

  const [rawHeader, rawPayload, rawSig] = parts

  let header, payload
  try {
    header  = JSON.parse(b64url(rawHeader).toString('utf8'))
    payload = JSON.parse(b64url(rawPayload).toString('utf8'))
  } catch {
    throw new Error('Failed to decode JWT')
  }

  // ── Claim checks ──────────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000)

  if (!payload.sub)                         throw new Error('Missing sub claim')
  if (payload.exp < now)                    throw new Error('Token expired')
  if (payload.iat > now + 300)              throw new Error('Token issued in future')
  if (payload.aud !== FIREBASE_PROJECT_ID)  throw new Error('Invalid audience')
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`)
    throw new Error('Invalid issuer')

  // ── Signature verification ────────────────────────────────────────────────
  if (header.alg !== 'RS256') throw new Error(`Unexpected algorithm: ${header.alg}`)
  if (!header.kid)             throw new Error('Missing kid in JWT header')

  const certs = await getPublicCerts()
  const cert  = certs[header.kid]
  if (!cert) throw new Error(`Unknown signing key: ${header.kid}`)

  const pubKey   = createPublicKey(cert)
  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${rawHeader}.${rawPayload}`)

  const valid = verifier.verify(pubKey, b64url(rawSig))
  if (!valid) throw new Error('JWT signature verification failed')

  return {
    uid:   payload.sub,
    email: payload.email  ?? null,
    name:  payload.name   ?? null,
  }
}
