import { google } from 'googleapis';
import { pool } from './db';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`
);

// Obtener URL de autorización
export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/gmail.send'
    ],
    prompt: 'consent',
  });
}

// Intercambiar código por tokens
export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Guardar tokens en la base de datos
export async function saveUserTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiryDate: number,
  scope: string
) {
  await pool.query(
    `INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, token_expiry, scope)
     VALUES ($1, $2, $3, to_timestamp($4/1000.0), $5)
     ON CONFLICT (user_id)
     DO UPDATE SET
       access_token = $2,
       refresh_token = $3,
       token_expiry = to_timestamp($4/1000.0),
       scope = $5,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, accessToken, refreshToken, expiryDate, scope]
  );
}

// Obtener tokens del usuario
export async function getUserTokens(userId: string) {
  const result = await pool.query(
    'SELECT access_token, refresh_token, token_expiry FROM google_calendar_tokens WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

// Crear cliente de Calendar autenticado
export async function getCalendarClient(userId: string) {
  const tokens = await getUserTokens(userId);

  if (!tokens) {
    throw new Error('No se encontraron tokens de Google Calendar para este usuario');
  }

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: new Date(tokens.token_expiry).getTime(),
  });

  // Refrescar token si ha expirado
  if (new Date(tokens.token_expiry) < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await saveUserTokens(
      userId,
      credentials.access_token!,
      credentials.refresh_token || tokens.refresh_token,
      credentials.expiry_date!,
      credentials.scope!
    );
    oauth2Client.setCredentials(credentials);
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Crear evento en Google Calendar
export async function createCalendarEvent(
  userId: string,
  title: string,
  description: string,
  date: Date | string,
  time?: string
) {
  try {
    const calendar = await getCalendarClient(userId);

    // Crear fecha correctamente en la zona horaria local
    // Si date viene como string "2025-11-17", necesitamos parsearlo correctamente
    let startDateTime: Date;

    if (typeof date === 'string') {
      // Parsear la fecha como fecha local, no UTC
      const [year, month, day] = date.split('-').map(Number);
      startDateTime = new Date(year, month - 1, day);
    } else {
      startDateTime = new Date(date);
    }

    // Agregar la hora si existe
    if (time) {
      const [hours, minutes] = time.split(':');
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      // Si no hay hora, usar 9:00 AM por defecto
      startDateTime.setHours(9, 0, 0, 0);
    }

    // La duración por defecto es 1 hora
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1);

    const event = {
      summary: title,
      description: description || undefined,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Lima',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Lima',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return response.data.id;
  } catch (error) {
    console.error('Error al crear evento en Google Calendar:', error);
    throw error;
  }
}

// Actualizar evento en Google Calendar
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  title: string,
  description: string,
  date: Date | string,
  time?: string
) {
  try {
    const calendar = await getCalendarClient(userId);

    // Crear fecha correctamente en la zona horaria local
    let startDateTime: Date;

    if (typeof date === 'string') {
      // Parsear la fecha como fecha local, no UTC
      const [year, month, day] = date.split('-').map(Number);
      startDateTime = new Date(year, month - 1, day);
    } else {
      startDateTime = new Date(date);
    }

    // Agregar la hora si existe
    if (time) {
      const [hours, minutes] = time.split(':');
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      // Si no hay hora, usar 9:00 AM por defecto
      startDateTime.setHours(9, 0, 0, 0);
    }

    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1);

    const event = {
      summary: title,
      description: description || undefined,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Mexico_City',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Mexico_City',
      },
    };

    await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: event,
    });
  } catch (error) {
    console.error('Error al actualizar evento en Google Calendar:', error);
    throw error;
  }
}

// Eliminar evento de Google Calendar
export async function deleteCalendarEvent(userId: string, eventId: string) {
  try {
    const calendar = await getCalendarClient(userId);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
  } catch (error) {
    console.error('Error al eliminar evento de Google Calendar:', error);
    throw error;
  }
}

// Verificar si el usuario tiene tokens
export async function userHasCalendarAccess(userId: string): Promise<boolean> {
  const tokens = await getUserTokens(userId);
  return tokens !== null;
}
