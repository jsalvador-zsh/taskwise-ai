import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { UpdateTaskInput, ApiResponse, Task } from '@/lib/types';
import { auth } from '@/lib/auth';
import { emitTaskEvent } from '@/lib/socket-helper';
import { updateCalendarEvent, deleteCalendarEvent, userHasCalendarAccess } from '@/lib/google-calendar';

// GET /api/tasks/[id] - Obtener una tarea por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const result = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [id, session.user.id]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Tarea no encontrada',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<Task> = {
      success: true,
      data: result.rows[0],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al obtener tarea:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al obtener la tarea',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// PUT /api/tasks/[id] - Actualizar una tarea
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body: UpdateTaskInput = await request.json();

    // Construir la query dinámicamente basado en los campos proporcionados
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (body.title !== undefined) {
      fields.push(`title = $${paramCount}`);
      values.push(body.title);
      paramCount++;
    }

    if (body.description !== undefined) {
      fields.push(`description = $${paramCount}`);
      values.push(body.description);
      paramCount++;
    }

    if (body.status !== undefined) {
      fields.push(`status = $${paramCount}`);
      values.push(body.status);
      paramCount++;

      // Si se marca como completada, actualizar completed_at
      if (body.status === 'completed') {
        fields.push(`completed_at = CURRENT_TIMESTAMP`);
      } else if (body.status !== 'completed') {
        fields.push(`completed_at = NULL`);
      }
    }

    if (body.priority !== undefined) {
      fields.push(`priority = $${paramCount}`);
      values.push(body.priority);
      paramCount++;
    }

    if (body.due_date !== undefined) {
      fields.push(`due_date = $${paramCount}`);
      values.push(body.due_date);
      paramCount++;
    }

    if (body.time !== undefined) {
      fields.push(`time = $${paramCount}`);
      values.push(body.time);
      paramCount++;
    }

    if (fields.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No se proporcionaron campos para actualizar',
      };
      return NextResponse.json(response, { status: 400 });
    }

    values.push(id);
    values.push(session.user.id);

    const result = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Tarea no encontrada',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const updatedTask = result.rows[0];

    // Sincronizar con Google Calendar si existe un evento asociado
    if (updatedTask.google_calendar_event_id && updatedTask.due_date) {
      try {
        const hasCalendarAccess = await userHasCalendarAccess(session.user.id);

        if (hasCalendarAccess) {
          await updateCalendarEvent(
            session.user.id,
            updatedTask.google_calendar_event_id,
            updatedTask.title,
            updatedTask.description || '',
            updatedTask.due_date,
            updatedTask.time
          );
        }
      } catch (calendarError) {
        console.error('Error al actualizar en Google Calendar:', calendarError);
        // No fallar la actualización de la tarea si falla la sincronización
      }
    }

    // Emitir evento de Socket.io
    emitTaskEvent(session.user.id, 'task:updated', updatedTask);

    const response: ApiResponse<Task> = {
      success: true,
      data: updatedTask,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al actualizar tarea:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al actualizar la tarea',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - Eliminar una tarea
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Primero obtener la tarea para verificar si tiene un evento de Google Calendar
    const taskResult = await pool.query(
      'SELECT google_calendar_event_id FROM tasks WHERE id = $1 AND user_id = $2',
      [id, session.user.id]
    );

    if (taskResult.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Tarea no encontrada',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const task = taskResult.rows[0];

    // Eliminar de Google Calendar si existe un evento asociado
    if (task.google_calendar_event_id) {
      try {
        const hasCalendarAccess = await userHasCalendarAccess(session.user.id);

        if (hasCalendarAccess) {
          await deleteCalendarEvent(session.user.id, task.google_calendar_event_id);
        }
      } catch (calendarError) {
        console.error('Error al eliminar de Google Calendar:', calendarError);
        // No fallar la eliminación de la tarea si falla la sincronización
      }
    }

    // Eliminar la tarea de la base de datos
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, session.user.id]
    );

    const deletedId = result.rows[0].id;

    // Emitir evento de Socket.io
    emitTaskEvent(session.user.id, 'task:deleted', { id: deletedId });

    const response: ApiResponse = {
      success: true,
      data: { id: deletedId },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al eliminar tarea:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al eliminar la tarea',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
