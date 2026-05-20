// Next.js edge middleware — redirects unauthenticated users away from /dashboard
import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard')) {
    const authCookie =
      request.cookies.get('firebase-auth-token') ||
      request.cookies.get('__session')

    if (!authCookie) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
