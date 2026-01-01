import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCalendarClient } from '@/lib/google-calendar';

// GET /api/google-calendar/account - Obtener información de la cuenta conectada
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    try {
      const calendar = await getCalendarClient(user.id);

      // Obtener información del perfil del usuario de Google
      const response = await calendar.calendarList.get({
        calendarId: 'primary'
      });

      return NextResponse.json({
        success: true,
        account: {
          email: response.data.id,
          summary: response.data.summary,
        }
      });
    } catch (error) {
      // Si no hay tokens o falló, retornar que no está conectado
      return NextResponse.json({
        success: true,
        account: null
      });
    }
  } catch (error) {
    console.error('Error al obtener cuenta de Google Calendar:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener información de la cuenta' },
      { status: 500 }
    );
  }
}
