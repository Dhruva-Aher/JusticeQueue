// Cloud Monitoring — custom time series metrics per docket run via the Cloud Monitoring REST API.
// Uses the same OAuth 2.0 Bearer token already obtained for Vertex AI (getAccessToken).
// This is fire-and-forget: monitoring failures do not affect agent execution.
//
// API: https://monitoring.googleapis.com/v3/projects/{project}/timeSeries
// Scopes required: already covered by cloud-platform scope on the refresh token.
//
// View in GCP Console:
//   Monitoring → Metrics Explorer → Resource: Global → Metric: custom.googleapis.com/justicequeue/*
//   Or filter: metric.type = "custom.googleapis.com/justicequeue/run_duration_ms"
//
// Metrics written per docket run:
//   justicequeue/run_duration_ms      — total agent execution time
//   justicequeue/cases_reviewed       — cases in the queue
//   justicequeue/critical_cases       — cases with deadline ≤3 days
//   justicequeue/vector_matches       — Atlas $vectorSearch matches found
//   justicequeue/recommendations      — attorney recommendations generated
//   justicequeue/decisions_logged     — branching decisions recorded
//   justicequeue/adaptive_search      — 1 if adaptive search was triggered, 0 otherwise

import { getAccessToken } from './gemini.js'

const MONITORING_ENDPOINT = (projectId) =>
  `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries`

/**
 * Write custom time series metrics to Google Cloud Monitoring for a completed docket run.
 * Non-blocking — errors are silently suppressed.
 */
export async function recordDocketMetrics({
  duration_ms,
  cases_reviewed,
  critical_cases,
  vector_matches,
  recommendations,
  decisions_logged,
  adaptive_search_triggered,
  model_strategy,
}) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  if (!projectId) return  // Skip if GCP not configured

  ;(async () => {
    try {
      const token     = await getAccessToken()
      const endTime   = new Date().toISOString()
      const resource  = { type: 'global', labels: { project_id: projectId } }
      const strategy  = model_strategy || 'unknown'

      const metrics = [
        { name: 'run_duration_ms',   value: duration_ms                         ?? 0 },
        { name: 'cases_reviewed',    value: cases_reviewed                      ?? 0 },
        { name: 'critical_cases',    value: critical_cases                      ?? 0 },
        { name: 'vector_matches',    value: vector_matches                      ?? 0 },
        { name: 'recommendations',   value: recommendations                     ?? 0 },
        { name: 'decisions_logged',  value: decisions_logged                    ?? 0 },
        { name: 'adaptive_search',   value: adaptive_search_triggered ? 1 : 0       },
      ]

      const timeSeries = metrics.map(({ name, value }) => ({
        metric: {
          type:   `custom.googleapis.com/justicequeue/${name}`,
          labels: { strategy },
        },
        resource,
        metricKind: 'GAUGE',
        valueType:  'INT64',
        points: [{
          interval: { endTime },
          value:    { int64Value: String(Math.round(value)) },
        }],
      }))

      await fetch(MONITORING_ENDPOINT(projectId), {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ timeSeries }),
        signal:  AbortSignal.timeout(5000),
      })
    } catch {
      // Non-fatal — monitoring failure never disrupts the agent pipeline
    }
  })()
}
