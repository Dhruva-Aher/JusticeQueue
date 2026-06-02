// Cloud Logging — structured telemetry for agent runs via the Cloud Logging REST API.
// Uses the same OAuth 2.0 Bearer token already obtained for Vertex AI (getAccessToken).
// This is fire-and-forget: logging failures do not affect agent execution.
//
// API: https://logging.googleapis.com/v2/entries:write
// Scopes required: already covered by the cloud-platform scope on the refresh token.
//
// Log name: projects/{project}/logs/justicequeue.agent
// View in GCP Console → Logging → Log Explorer → logName="justicequeue.agent"

import { getAccessToken } from './gemini.js'

const LOGGING_ENDPOINT = 'https://logging.googleapis.com/v2/entries:write'

/**
 * Log a structured agent run summary to Google Cloud Logging.
 * Non-blocking — resolves immediately, error is silently suppressed.
 *
 * @param {object} payload - Structured data to log (serializable to JSON)
 * @param {'INFO'|'WARNING'|'ERROR'} severity
 */
export async function logToCloud(payload, severity = 'INFO') {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  if (!projectId) return  // Skip if GCP not configured

  // Fire-and-forget: do not await, do not block the agent pipeline
  ;(async () => {
    try {
      const token = await getAccessToken()
      const body = {
        entries: [
          {
            logName:  `projects/${projectId}/logs/justicequeue.agent`,
            resource: { type: 'global', labels: { project_id: projectId } },
            severity,
            jsonPayload: {
              service:    'justicequeue',
              version:    '1.0',
              ...payload,
            },
            timestamp: new Date().toISOString(),
          },
        ],
        partialSuccess: true,  // don't fail if individual entries are malformed
      }

      await fetch(LOGGING_ENDPOINT, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(5000),
      })
    } catch {
      // Non-fatal — cloud logging failure never disrupts the agent pipeline
    }
  })()
}
