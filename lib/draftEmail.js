// Generate personalised outreach email — uses Flash (3-4 sentence task, no quality loss)
import { callGeminiFlash } from './gemini.js'

const SUBJECT_MAP = {
  eviction:   'Re: Your housing legal aid request',
  immigration: 'Re: Your immigration legal aid request',
  wage_theft:  'Re: Your wage claim request',
  custody:     'Re: Your family law request',
  employment:  'Re: Your employment legal aid request',
}

export async function generateOutreachEmail(caseData) {
  const missingInfo  = caseData.extracted?.missing_info?.join(', ')
  const priorityText = caseData.priority_score >= 80
    ? 'Your case has been flagged as high priority. A caseworker will contact you within 24 hours.'
    : 'We have received your request and will review it shortly.'

  const prompt = `Client: ${caseData.extracted?.client_name || 'the client'} | Type: ${caseData.case_type}
Situation: ${caseData.extracted?.summary}
Priority message (include verbatim): ${priorityText}
${missingInfo ? `Documents needed: ${missingInfo}` : ''}

Write 3-4 sentences. Be warm and specific. ${missingInfo ? 'Ask for listed documents.' : ''} No jargon. No AI mention. No sign-off. Return only the email body.`

  const body    = await callGeminiFlash(
    'You are a nonprofit legal aid clinic writing a client email. Return only the email body — no subject, greeting, or signature.',
    prompt
  )
  const subject = SUBJECT_MAP[caseData.case_type] || 'Re: Your legal aid request'

  return { subject, body: body.trim() }
}
