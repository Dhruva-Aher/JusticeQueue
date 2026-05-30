// Pure-JS input validation helpers — no external dependencies
// Used by API routes to validate dynamic inputs before touching the database.

const OID_RE  = /^[0-9a-f]{24}$/i
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Asserts that id is a valid MongoDB ObjectId (24-char hex string).
 * Throws Error('INVALID_ID') otherwise.
 */
export function assertObjectId(id) {
  if (!OID_RE.test(id)) throw new Error('INVALID_ID')
}

/**
 * Asserts that id is a valid UUID v4.
 * Throws Error('INVALID_UUID') otherwise.
 */
export function assertUUID(id) {
  if (!UUID_RE.test(id)) throw new Error('INVALID_UUID')
}

/**
 * Asserts that body contains all requiredKeys as non-undefined values.
 * Throws Error('MISSING_FIELDS') otherwise.
 */
export function assertBody(body, requiredKeys) {
  for (const key of requiredKeys) {
    if (body[key] === undefined || body[key] === null) throw new Error('MISSING_FIELDS')
  }
}

/**
 * Trims whitespace, slices to maxLen, and strips null bytes from s.
 * Returns '' if s is not a string.
 */
export function sanitizeString(s, maxLen) {
  if (typeof s !== 'string') return ''
  return s.trim().slice(0, maxLen).replace(/\x00/g, '')
}
