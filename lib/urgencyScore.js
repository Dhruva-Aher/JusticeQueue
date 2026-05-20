// Pure scoring function — computeScore(extracted, similarCases) → { score, breakdown, reason_string }

const CASE_TYPE_POINTS = {
  immigration: 20,
  eviction: 18,
  wage_theft: 12,
  custody: 10,
  employment: 8,
  other: 5,
}

function deadlinePoints(days) {
  if (days == null) return 0
  if (days <= 3) return 40
  if (days <= 7) return 25
  if (days <= 14) return 15
  return 0
}

function vulnerabilityPoints(flags) {
  if (!flags) return 0
  let pts = 0
  if (flags.minor_children) pts += 15
  if (flags.language_barrier) pts += 10
  if (flags.medical_condition) pts += 10
  return Math.min(pts, 25)
}

function similarityPoints(similarCases) {
  if (!Array.isArray(similarCases) || similarCases.length === 0) return 0
  const won = similarCases.filter((c) => c.outcome === 'won')
  const best = won.reduce((max, c) => (c.similarity_score > max ? c.similarity_score : max), 0)
  if (best >= 0.85) return 15
  if (best >= 0.70) return 8
  return 0
}

function topContributors(breakdown) {
  return Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
    .filter(([, v]) => v > 0)
    .slice(0, 2)
    .map(([k]) => k.replace('_points', '').replace('_', ' '))
}

export function computeScore(extracted, similarCases) {
  const dl = deadlinePoints(extracted?.deadline_days)
  const vl = vulnerabilityPoints(extracted?.vulnerability_flags)
  const ct = CASE_TYPE_POINTS[extracted?.case_type] ?? 5
  const sim = similarityPoints(similarCases)

  const score = Math.min(dl + vl + ct + sim, 100)

  const breakdown = {
    deadline_points: dl,
    vulnerability_points: vl,
    case_type_points: ct,
    similarity_points: sim,
  }

  const top = topContributors(breakdown)
  const reason_string = top.length > 0
    ? `Urgency driven by ${top.join(' and ')}.`
    : 'Low urgency — no critical factors detected.'

  return { score, breakdown, reason_string }
}
