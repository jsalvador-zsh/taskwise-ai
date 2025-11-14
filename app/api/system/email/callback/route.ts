import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { pool } from '@/lib/db';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/system/email/callback`
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/?system_email_error=${error}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?system_email_error=no_code', request.url));
    }

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/?system_email_error=invalid_tokens', request.url));
    }

    // Obtener email del usuario
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    if (!email) {
      return NextResponse.redirect(new URL('/?system_email_error=no_email', request.url));
    }

    // Guardar tokens en la base de datos
    await pool.query(
      `INSERT INTO system_email_tokens (email, access_token, refresh_token, token_expiry, scope)
       VALUES ($1, $2, $3, to_timestamp($4/1000.0), $5)
       ON CONFLICT (email)
       DO UPDATE SET
         access_token = $2,
         refresh_token = $3,
         token_expiry = to_timestamp($4/1000.0),
         scope = $5,
         updated_at = CURRENT_TIMESTAMP`,
      [
        email,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date || Date.now() + 3600000,
        tokens.scope || 'https://www.googleapis.com/auth/gmail.send'
      ]
    );

    console.log(`✅ Sistema de email configurado con la cuenta: ${email}`);

    // Actualizar variable de entorno en memoria (solo para esta sesión)
    process.env.SYSTEM_EMAIL_USER = email;

    // Redirigir con mensaje de éxito
    return NextResponse.redirect(new URL('/?system_email_connected=true&email=' + encodeURIComponent(email), request.url));
  } catch (error) {
    console.error('Error en callback del sistema de email:', error);
    return NextResponse.redirect(new URL('/?system_email_error=callback_failed', request.url));
  }
}
