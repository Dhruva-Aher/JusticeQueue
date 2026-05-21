// Middleware — no auth check here because Firebase Auth stores session in
// localStorage (not cookies), which is inaccessible at the edge.
// Route protection is handled client-side in each protected page.
import { NextResponse } from 'next/server'

export function middleware(request) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
