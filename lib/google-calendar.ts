import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
);

// Cliente Supabase con service_role para acceso desde server
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
  const supabase = getSupabaseAdmin();

  const tokenExpiry = new Date(expiryDate).toISOString();

  const { error } = await supabase
    .from('google_calendar_tokens')
    .upsert({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: tokenExpiry,
      scope: scope,
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error saving Google Calendar tokens:', error);
    throw error;
  }
}

// Obtener tokens del usuario
export async function getUserTokens(userId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
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
  time?: string | null,
  attendees?: string[]
) {
  console.log('🚀 VERSION 3.1 - createCalendarEvent con asistentes');
  let eventToCreate: any;

  try {
    const calendar = await getCalendarClient(userId);

    // ... (parsing logic same as before)
    let dateStr: string;
    if (typeof date === 'string') {
      dateStr = date.split('T')[0];
    } else {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    let timeStr: string | null = null;
    if (time) {
      const timeParts = time.split(':');
      timeStr = `${timeParts[0]}:${timeParts[1]}`;
    }

    const startEndData: any = timeStr ? {
      start: { dateTime: `${dateStr}T${timeStr}:00`, timeZone: 'America/Lima' },
      end: { dateTime: `${dateStr}T${String(Number(timeStr.split(':')[0]) + 1).padStart(2, '0')}:${timeStr.split(':')[1]}:00`, timeZone: 'America/Lima' }
    } : {
      start: { date: dateStr },
      end: { date: dateStr }
    };

    eventToCreate = {
      summary: title,
      description: description || undefined,
      ...startEndData,
      attendees: attendees?.map(email => ({ email })) || []
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventToCreate,
      sendUpdates: 'all' // Esto envía la invitación por email
    });

    console.log('✅ Evento creado con ID:', response.data.id);

    return response.data.id;
  } catch (error: any) {
    console.error('❌ Error al crear evento en Google Calendar:');
    console.error('Error message:', error?.message);
    console.error('Error status:', error?.response?.status);
    console.error('Error statusText:', error?.response?.statusText);
    console.error('Error data:', JSON.stringify(error?.response?.data, null, 2));

    // Loguear detalles del evento que intentamos crear
    console.error('Evento que causó el error:', JSON.stringify(eventToCreate, null, 2));

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
  time?: string | null,
  attendees?: string[]
) {
  try {
    const calendar = await getCalendarClient(userId);

    console.log('📅 Actualizando evento en Google Calendar con asistentes:', { eventId, attendees });

    // Parsear fecha - puede venir como string "2025-11-17" o timestamp "2026-01-03T00:00:00+00:00"
    let dateStr: string;

    if (typeof date === 'string') {
      // Extraer solo la parte de fecha YYYY-MM-DD
      dateStr = date.split('T')[0]; // "2026-01-03T00:00:00+00:00" → "2026-01-03"
    } else {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    // Parsear time - puede venir como "14:42" o "14:42:00"
    let timeStr: string | null = null;
    if (time) {
      // Extraer solo HH:mm (sin segundos)
      const timeParts = time.split(':');
      timeStr = `${timeParts[0]}:${timeParts[1]}`; // "14:42:00" → "14:42"
    }

    const startEndData: any = timeStr ? {
      start: { dateTime: `${dateStr}T${timeStr}:00`, timeZone: 'America/Lima' },
      end: { dateTime: `${dateStr}T${String(Number(timeStr.split(':')[0]) + 1).padStart(2, '0')}:${timeStr.split(':')[1]}:00`, timeZone: 'America/Lima' }
    } : {
      start: { date: dateStr },
      end: { date: dateStr }
    };

    const eventToUpdate: any = {
      summary: title,
      description: description || undefined,
      ...startEndData,
      attendees: attendees?.map(email => ({ email })) || []
    };

    console.log('📅 Evento a actualizar:', JSON.stringify(eventToUpdate, null, 2));

    await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: eventToUpdate,
      sendUpdates: 'all'
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
