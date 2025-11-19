import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';

// DELETE /api/google-calendar/disconnect - Desconectar Google Calendar
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Eliminar tokens de Google Calendar del usuario
    await pool.query(
      'DELETE FROM google_calendar_tokens WHERE user_id = $1',
      [session.user.id]
    );

    // Opcional: Eliminar google_calendar_event_id de todas las tareas
    await pool.query(
      'UPDATE tasks SET google_calendar_event_id = NULL WHERE user_id = $1',
      [session.user.id]
    );

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
