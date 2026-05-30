// Generate personalised outreach email for each case using Gemini Pro
import { callGeminiPro } from './gemini.js'

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

  const prompt = `You are writing on behalf of a nonprofit legal aid clinic.

Write a warm, professional email to a client who submitted an intake request.
Client name: ${caseData.extracted?.client_name || 'the client'}
Case type: ${caseData.case_type}
Situation: ${caseData.extracted?.summary}
Priority message: ${priorityText}
${missingInfo ? `Documents needed: ${missingInfo}` : ''}

Write 3-4 sentences maximum. Be warm and specific to their situation. Include the priority message exactly as written above. ${missingInfo ? 'Ask them to provide the listed documents.' : ''} Do not use legal jargon. Do not mention AI. Do not add a sign-off. Return only the email body. No subject line. No greeting. No signature.`

  const body    = await callGeminiPro(prompt)
  const subject = SUBJECT_MAP[caseData.case_type] || 'Re: Your legal aid request'

  return { subject, body: body.trim() }
}
