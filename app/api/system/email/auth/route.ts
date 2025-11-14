import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/system/email/callback`
);

// Generar URL de autorización para el sistema de email y redirigir a Google OAuth
export async function GET(request: Request) {
  try {
    // Verificar que las variables de entorno estén configuradas
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      const errorUrl = new URL('/?system_email_error=not_configured', request.url);
      return NextResponse.redirect(errorUrl);
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
      prompt: 'consent',
    });

    // Redirigir directamente a Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error al obtener URL de autenticación del sistema:', error);
    const errorUrl = new URL('/?system_email_error=auth_failed', request.url);
    return NextResponse.redirect(errorUrl);
  }
}
