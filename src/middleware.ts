import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  try {
    // Não fazer verificação de auth no middleware para evitar problemas
    // A proteção será feita no lado cliente
    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return res
  }
}

export const config = {
  matcher: ['/dashboard/:path*']
}