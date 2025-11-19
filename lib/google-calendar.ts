import { google } from 'googleapis';
import { pool } from './db';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`
);

// Obtener URL de autorización
export function getAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events', // Crear, leer, actualizar y eliminar eventos
    'https://www.googleapis.com/auth/userinfo.email',  // Leer email del usuario
  ];

  console.log('🔑 Generando URL de autorización con scopes:', scopes);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
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
    console.error('❌ No se encontraron tokens para el usuario:', userId);
    throw new Error('No se encontraron tokens de Google Calendar para este usuario');
  }

  console.log('🔑 Tokens encontrados para usuario:', userId);
  console.log('🔑 Token expiry:', tokens.token_expiry);
  console.log('🔑 Token expirado?:', new Date(tokens.token_expiry) < new Date());

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: new Date(tokens.token_expiry).getTime(),
  });

  // Refrescar token si ha expirado
  if (new Date(tokens.token_expiry) < new Date()) {
    console.log('🔄 Refrescando token expirado...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    await saveUserTokens(
      userId,
      credentials.access_token!,
      credentials.refresh_token || tokens.refresh_token,
      credentials.expiry_date!,
      credentials.scope!
    );
    oauth2Client.setCredentials(credentials);
    console.log('✅ Token refrescado exitosamente');
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

    console.log('📅 Creando evento en Google Calendar:', { date, time, dateType: typeof date });

    // Parsear fecha y hora
    let dateStr: string;
    let timeStr: string;

    if (typeof date === 'string') {
      dateStr = date; // "2025-11-17"
    } else {
      // Convertir Date a string YYYY-MM-DD en zona horaria local
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    timeStr = time || '09:00';

    // Construir la fecha/hora en formato ISO pero interpretada en America/Lima
    // Formato: "2025-11-17T09:00:00" (sin Z para que se interprete en la zona horaria especificada)
    const dateTimeStr = `${dateStr}T${timeStr}:00`;

    console.log('📅 DateTime string para Google Calendar:', dateTimeStr);

    // Calcular la hora de fin (1 hora después)
    const [hours, minutes] = timeStr.split(':').map(Number);
    const endHours = hours + 1;
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const endDateTimeStr = `${dateStr}T${endTimeStr}:00`;

    const event = {
      summary: title,
      description: description || undefined,
      start: {
        dateTime: dateTimeStr,
        timeZone: 'America/Lima',
      },
      end: {
        dateTime: endDateTimeStr,
        timeZone: 'America/Lima',
      },
    };

    console.log('📅 Evento a crear:', JSON.stringify(event, null, 2));

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    console.log('✅ Evento creado con ID:', response.data.id);

    return response.data.id;
  } catch (error: any) {
    console.error('❌ Error al crear evento en Google Calendar:');
    console.error('Error completo:', JSON.stringify(error, null, 2));
    console.error('Error message:', error?.message);
    console.error('Error response:', error?.response?.data);
    console.error('Error config:', error?.config);
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

    console.log('📅 Actualizando evento en Google Calendar:', { eventId, date, time, dateType: typeof date });

    // Parsear fecha y hora
    let dateStr: string;
    let timeStr: string;

    if (typeof date === 'string') {
      dateStr = date; // "2025-11-17"
    } else {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    timeStr = time || '09:00';

    // Construir la fecha/hora en formato ISO interpretada en America/Lima
    const dateTimeStr = `${dateStr}T${timeStr}:00`;

    // Calcular la hora de fin (1 hora después)
    const [hours, minutes] = timeStr.split(':').map(Number);
    const endHours = hours + 1;
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const endDateTimeStr = `${dateStr}T${endTimeStr}:00`;

    const event = {
      summary: title,
      description: description || undefined,
      start: {
        dateTime: dateTimeStr,
        timeZone: 'America/Lima',
      },
      end: {
        dateTime: endDateTimeStr,
        timeZone: 'America/Lima',
      },
    };

    console.log('📅 Evento a actualizar:', JSON.stringify(event, null, 2));

    await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: event,
    });

    console.log('✅ Evento actualizado correctamente');
  } catch (error) {
    console.error('❌ Error al actualizar evento en Google Calendar:', error);
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
