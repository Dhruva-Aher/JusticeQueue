// Root layout — wraps all pages in AuthContext and imports global styles
import './globals.css'

export const metadata = {
  title: 'JusticeQueue',
  description: 'AI triage agent for legal aid clinics',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
