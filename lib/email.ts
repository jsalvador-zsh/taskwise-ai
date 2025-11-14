import { google } from 'googleapis';
import { pool } from './db';

// Función para generar código de verificación de 6 dígitos
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Obtener tokens del sistema para enviar emails
async function getSystemEmailTokens() {
  // Intentar obtener de la tabla system_email_tokens
  const result = await pool.query(
    'SELECT email, access_token, refresh_token, token_expiry FROM system_email_tokens ORDER BY created_at DESC LIMIT 1'
  );

  if (result.rows.length === 0) {
    return null;
  }

  const tokenData = result.rows[0];

  // Actualizar SYSTEM_EMAIL_USER en memoria si no está configurado
  if (!process.env.SYSTEM_EMAIL_USER && tokenData.email) {
    process.env.SYSTEM_EMAIL_USER = tokenData.email;
  }

  return tokenData;
}

// Crear cliente de Gmail autenticado
async function getGmailClient() {
  const tokens = await getSystemEmailTokens();

  if (!tokens) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/system/email/callback`
  );

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: new Date(tokens.token_expiry).getTime(),
  });

  // Refrescar token si ha expirado
  if (new Date(tokens.token_expiry) < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    // Actualizar tokens en BD
    if (credentials.access_token) {
      await pool.query(
        `UPDATE system_email_tokens
         SET access_token = $1,
             refresh_token = $2,
             token_expiry = to_timestamp($3/1000.0),
             updated_at = CURRENT_TIMESTAMP
         WHERE email = $4`,
        [
          credentials.access_token,
          credentials.refresh_token || tokens.refresh_token,
          credentials.expiry_date!,
          tokens.email
        ]
      );
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Crear mensaje de email en formato MIME
function createEmailMessage(to: string, subject: string, htmlBody: string, textBody: string) {
  const fromEmail = process.env.SYSTEM_EMAIL_USER || 'noreply@taskwise.com';
  const fromName = process.env.EMAIL_FROM_NAME || 'TaskWise';

  const messageParts = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="boundary"',
    '',
    '--boundary',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    textBody,
    '',
    '--boundary',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
    '',
    '--boundary--',
  ];

  const message = messageParts.join('\n');
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Función para enviar email de verificación
export async function sendVerificationEmail(
  email: string,
  name: string,
  code: string
): Promise<void> {
  // En desarrollo, si no hay Gmail API configurado, mostrar en consola
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasGoogleConfig = process.env.GOOGLE_CLIENT_ID &&
                         process.env.GOOGLE_CLIENT_SECRET &&
                         process.env.GOOGLE_CLIENT_ID !== 'tu_google_client_id_aqui' &&
                         process.env.SYSTEM_EMAIL_USER;

  if (isDevelopment && !hasGoogleConfig) {
    console.log('\n' + '='.repeat(60));
    console.log('📧 CÓDIGO DE VERIFICACIÓN (Modo Desarrollo)');
    console.log('='.repeat(60));
    console.log(`Email: ${email}`);
    console.log(`Nombre: ${name}`);
    console.log(`Código: ${code}`);
    console.log('='.repeat(60));
    console.log('⚠️  Para enviar emails reales, configura Google OAuth');
    console.log('   Ver: CONFIGURACION_GOOGLE.md');
    console.log('='.repeat(60) + '\n');
    return;
  }

  try {
    const gmail = await getGmailClient();

    if (!gmail) {
      // Si no hay cliente de Gmail, modo desarrollo
      if (isDevelopment) {
        console.log('\n' + '='.repeat(60));
        console.log('📧 CÓDIGO DE VERIFICACIÓN (Modo Desarrollo)');
        console.log('='.repeat(60));
        console.log(`Email: ${email}`);
        console.log(`Nombre: ${name}`);
        console.log(`Código: ${code}`);
        console.log('='.repeat(60));
        console.log('⚠️  Gmail API no configurado. Conecta tu cuenta Google');
        console.log('='.repeat(60) + '\n');
        return;
      }
      throw new Error('Gmail API no configurado');
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4F46E5;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9fafb;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .code {
              background-color: #fff;
              border: 2px dashed #4F46E5;
              padding: 20px;
              text-align: center;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 5px;
              color: #4F46E5;
              margin: 20px 0;
              border-radius: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Bienvenido a TaskWise!</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${name}</strong>,</p>
              <p>Gracias por registrarte en TaskWise. Para completar tu registro, por favor verifica tu correo electrónico usando el siguiente código:</p>

              <div class="code">${code}</div>

              <p>Este código expirará en <strong>15 minutos</strong>.</p>

              <p>Si no solicitaste este registro, puedes ignorar este mensaje.</p>

              <p>Saludos,<br>El equipo de TaskWise</p>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textBody = `
Hola ${name},

Gracias por registrarte en TaskWise. Para completar tu registro, por favor verifica tu correo electrónico usando el siguiente código:

${code}

Este código expirará en 15 minutos.

Si no solicitaste este registro, puedes ignorar este mensaje.

Saludos,
El equipo de TaskWise
    `;

    const encodedMessage = createEmailMessage(
      email,
      'Verifica tu cuenta - TaskWise',
      htmlBody,
      textBody
    );

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`✅ Email de verificación enviado a: ${email}`);
  } catch (error) {
    console.error('❌ Error al enviar email:', error);

    // En desarrollo, mostrar el código en consola si falla el envío
    if (isDevelopment) {
      console.log('\n' + '='.repeat(60));
      console.log('📧 CÓDIGO DE VERIFICACIÓN (Error al enviar email)');
      console.log('='.repeat(60));
      console.log(`Email: ${email}`);
      console.log(`Nombre: ${name}`);
      console.log(`Código: ${code}`);
      console.log('='.repeat(60) + '\n');
      return;
    }

    throw new Error('No se pudo enviar el email de verificación');
  }
}
