// File parser — parseFile(buffer, mimetype) → string[] of intake texts
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

function parseCSV(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine)
  const descIndex = headers.findIndex((h) =>
    h.toLowerCase().includes('description') || h.toLowerCase().includes('text') || h.toLowerCase().includes('intake')
  )

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line)
    if (descIndex >= 0 && cols[descIndex]) {
      const meta = cols
        .map((v, i) => (i !== descIndex && headers[i] ? `${headers[i]}: ${v}` : null))
        .filter(Boolean)
        .join('. ')
      return `${meta ? meta + '. ' : ''}${cols[descIndex]}`
    }
    return cols.join('. ')
  }).filter(Boolean)
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export async function parseFile(buffer, mimetype) {
  const text = buffer.toString('utf-8')

  if (mimetype === 'text/csv' || mimetype === 'application/vnd.ms-excel') {
    return parseCSV(text)
  }

  if (mimetype === 'text/plain') {
    return text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  }

  if (mimetype === 'application/pdf') {
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text.split(/\f|\n{3,}/).map((b) => b.trim()).filter(Boolean)
  }

  return [text]
}
