import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE /api/google-calendar/disconnect - Desconectar Google Calendar
export async function DELETE() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Eliminar tokens de Google Calendar del usuario
    await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', user.id);

    // Opcional: Eliminar google_calendar_event_id de todas las tareas
    await supabase
      .from('tasks')
      .update({ google_calendar_event_id: null })
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Google Calendar desconectado exitosamente'
    });
  } catch (error) {
    console.error('Error al desconectar Google Calendar:', error);
    return NextResponse.json(
      { success: false, error: 'Error al desconectar Google Calendar' },
      { status: 500 }
    );
  }
}
