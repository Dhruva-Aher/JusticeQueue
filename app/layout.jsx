// Root layout — wraps all pages in AuthContext and imports global styles
import './globals.css'
import { AuthProvider } from '../context/AuthContext.jsx'

export const metadata = {
  title: 'JusticeQueue',
  description: 'AI triage agent for legal aid clinics',
}

import { Toaster } from 'sonner'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  )
}
