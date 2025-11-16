import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug logging
  console.log('🔍 Middleware - Path:', pathname);
  console.log('🔍 Environment:', process.env.NODE_ENV);
  console.log('🔍 Cookies:', request.headers.get('cookie'));

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
    cookieName: process.env.NODE_ENV === 'production'
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
  });

  console.log('🔍 Token found:', !!token);
  if (token) {
    console.log('🔍 Token data:', { id: token.id, email: token.email });
  }

  // Debug en producción (temporal)
  if (!token && pathname === '/') {
    console.log('❌ No token found for path:', pathname);
    console.log('🔍 NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
    console.log('🔍 NEXTAUTH_SECRET length:', process.env.NEXTAUTH_SECRET?.length);
  }

  // Rutas públicas que no requieren autenticación
  const publicPaths = [
    '/login',
    '/register',
    '/api/auth',
    '/api/register',
    '/api/system/email' // Rutas del sistema de email (configuración)
  ];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // Si está en una ruta pública, permitir acceso
  if (isPublicPath) {
    // Si ya está autenticado y está en login/register, redirigir a home
    if (token && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Si no está autenticado y está en ruta protegida, redirigir a login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Usuario autenticado, permitir acceso
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
