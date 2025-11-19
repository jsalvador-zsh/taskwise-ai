import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTokensFromCode, saveUserTokens } from '@/lib/google-calendar';

export async function GET(request: Request) {
  try {
    const session = await auth();

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
    console.log('🔑 Intercambiando código por tokens...');
    const tokens = await getTokensFromCode(code);

    console.log('🔑 Tokens recibidos de Google:', {
      has_access_token: !!tokens.access_token,
      has_refresh_token: !!tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope
    });

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('❌ Tokens inválidos recibidos');
      return NextResponse.redirect(new URL('/?error=invalid_tokens', request.url));
    }

    // Guardar tokens en la base de datos
    console.log('💾 Guardando tokens en la base de datos para usuario:', session.user.id);
    await saveUserTokens(
      session.user.id,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date || Date.now() + 3600000,
      tokens.scope || 'https://www.googleapis.com/auth/calendar.events'
    );

    console.log('✅ Tokens guardados exitosamente');

    // Redirigir al dashboard con mensaje de éxito
    return NextResponse.redirect(new URL('/?calendar_connected=true', request.url));
  } catch (error) {
    console.error('Error en callback de Google Calendar:', error);
    return NextResponse.redirect(new URL('/?error=callback_failed', request.url));
  }
}
