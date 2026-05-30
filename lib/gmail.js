// Gmail API helpers — create and send drafts via OAuth 2.0 bearer token
// Requires GMAIL_ENABLED=true and a refresh token scoped with gmail.compose
import { getAccessToken } from './gemini.js'

export async function createGmailDraft(to, subject, body) {
  if (!process.env.GMAIL_ENABLED || process.env.GMAIL_ENABLED !== 'true') {
    console.log('[JusticeQueue] Gmail disabled — set GMAIL_ENABLED=true')
    return { id: 'disabled', skipped: true }
  }

  const accessToken = await getAccessToken()

  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    body,
  ].join('\r\n')

  const encoded = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw: encoded } }),
    }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Gmail draft failed: ${err.error?.message || 'unknown'}`)
  }

  return response.json()
}

export async function sendGmailDraft(draftId) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: draftId }),
    }
  )

  if (!response.ok) throw new Error('Gmail send failed')
  return response.json()
}
