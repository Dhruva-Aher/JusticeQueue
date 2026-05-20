// Consistent API error response helper — apiError(message, status)
export function apiError(message, status = 400) {
  return Response.json({ error: message }, { status })
}
