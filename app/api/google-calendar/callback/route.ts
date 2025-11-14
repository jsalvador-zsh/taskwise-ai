import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { getTokensFromCode, saveUserTokens } from '@/lib/google-calendar';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authConfig);

    if (!session || !session.user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?error=no_code', request.url));
    }

    // Intercambiar código por tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/?error=invalid_tokens', request.url));
    }

    // Guardar tokens en la base de datos
    await saveUserTokens(
      session.user.id,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date || Date.now() + 3600000,
      tokens.scope || 'https://www.googleapis.com/auth/calendar.events'
    );

    // Redirigir al dashboard con mensaje de éxito
    return NextResponse.redirect(new URL('/?calendar_connected=true', request.url));
  } catch (error) {
    console.error('Error en callback de Google Calendar:', error);
    return NextResponse.redirect(new URL('/?error=callback_failed', request.url));
  }
}
