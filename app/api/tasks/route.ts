import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CreateTaskInput, ApiResponse, Task } from '@/lib/types';
import { auth } from '@/lib/auth';
import { emitTaskEvent } from '@/lib/socket-helper';
import { createCalendarEvent, userHasCalendarAccess } from '@/lib/google-calendar';

// GET /api/tasks - Obtener todas las tareas del usuario autenticado
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [session.user.id]
    );

    const response: ApiResponse<Task[]> = {
      success: true,
      data: result.rows,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al obtener tareas:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al obtener las tareas',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// POST /api/tasks - Crear una nueva tarea
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body: CreateTaskInput = await request.json();

    // Validación básica
    if (!body.title || body.title.trim() === '') {
      const response: ApiResponse = {
        success: false,
        error: 'El título es requerido',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO tasks (title, description, status, priority, due_date, time, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        body.title,
        body.description || null,
        body.status || 'pending',
        body.priority || 'medium',
        body.due_date || null,
        body.time || null,
        session.user.id,
      ]
    );

    const newTask = result.rows[0];

    // Sincronizar con Google Calendar si el usuario tiene acceso
    if (newTask.due_date) {
      try {
        const hasCalendarAccess = await userHasCalendarAccess(session.user.id);

        if (hasCalendarAccess) {
          const eventId = await createCalendarEvent(
            session.user.id,
            newTask.title,
            newTask.description || '',
            newTask.due_date,
            newTask.time
          );

          // Actualizar la tarea con el ID del evento de Google Calendar
          await pool.query(
            'UPDATE tasks SET google_calendar_event_id = $1 WHERE id = $2',
            [eventId, newTask.id]
          );

          newTask.google_calendar_event_id = eventId;
        }
      } catch (calendarError) {
        console.error('Error al sincronizar con Google Calendar:', calendarError);
        // No fallar la creación de la tarea si falla la sincronización
      }
    }

    // Emitir evento de Socket.io
    emitTaskEvent(session.user.id, 'task:created', newTask);

    const response: ApiResponse<Task> = {
      success: true,
      data: newTask,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error al crear tarea:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al crear la tarea',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
