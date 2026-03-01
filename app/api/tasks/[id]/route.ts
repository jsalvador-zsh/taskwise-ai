import { NextRequest, NextResponse } from 'next/server';
import { UpdateTaskInput, ApiResponse, Task } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import { updateCalendarEvent, deleteCalendarEvent, userHasCalendarAccess } from '@/lib/google-calendar';

// GET /api/tasks/[id] - Obtener una tarea por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !task) {
      return NextResponse.json(
        { success: false, error: 'Tarea no encontrada' },
        { status: 404 }
      );
    }

    const response: ApiResponse<Task> = {
      success: true,
      data: task,
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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body: UpdateTaskInput = await request.json();

    // Construir el objeto de actualización dinámicamente
    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) {
      updateData.status = body.status;
      // Si se marca como completada, actualizar completed_at
      if (body.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }
    }
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.due_date !== undefined) updateData.due_date = body.due_date;
    if (body.time !== undefined) updateData.time = body.time;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      );
    }

    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !updatedTask) {
      return NextResponse.json(
        { success: false, error: 'Tarea no encontrada' },
        { status: 404 }
      );
    }

    // Registrar actividades para los cambios realizados
    const activities = [];
    if (body.status !== undefined) {
      activities.push({
        task_id: id,
        user_id: user.id,
        activity_type: 'status_changed',
        old_value: updatedTask.status === body.status ? 'N/A' : 'Anterior', // Sería ideal comparar con el valor previo real
        new_value: body.status
      });
    }
    if (body.priority !== undefined) {
      activities.push({
        task_id: id,
        user_id: user.id,
        activity_type: 'priority_changed',
        new_value: body.priority
      });
    }

    if (activities.length > 0) {
      await supabase.from('task_activities').insert(activities);
    }

    // Sincronizar con Google Calendar si existe un evento asociado
    if (updatedTask.google_calendar_event_id && updatedTask.due_date) {
      try {
        // IMPORTANTE: Siempre usamos el user_id del CREADOR de la tarea para Calendar
        const hasCalendarAccess = await userHasCalendarAccess(updatedTask.user_id);

        if (hasCalendarAccess) {
          // Obtener email del asignado para mantener la invitación
          const attendees = [];
          if (updatedTask.assigned_to) {
            const { data: assignedProf } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', updatedTask.assigned_to)
              .single();
            if (assignedProf?.email) attendees.push(assignedProf.email);
          }

          await updateCalendarEvent(
            updatedTask.user_id,
            updatedTask.google_calendar_event_id,
            updatedTask.title,
            updatedTask.description || '',
            updatedTask.due_date,
            updatedTask.time,
            attendees
          );
        }
      } catch (calendarError) {
        console.error('Error al actualizar en Google Calendar:', calendarError);
      }
    }

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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Obtener la tarea para verificar propiedad y Calendar
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('user_id, google_calendar_event_id')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 });
    }

    // RESTRICT: Solo el creador puede borrar
    if (task.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Solo el creador original de la tarea puede eliminarla.' },
        { status: 403 }
      );
    }

    // Eliminar de Google Calendar si existe un evento asociado
    if (task.google_calendar_event_id) {
      try {
        // IMPORTANTE: Usamos el user_id del CREADOR (task.user_id)
        const hasCalendarAccess = await userHasCalendarAccess(task.user_id);

        if (hasCalendarAccess) {
          await deleteCalendarEvent(task.user_id, task.google_calendar_event_id);
        }
      } catch (calendarError) {
        console.error('Error al eliminar de Google Calendar:', calendarError);
      }
    }

    // Eliminar la tarea de la base de datos
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error al eliminar tarea:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error al eliminar la tarea' },
        { status: 500 }
      );
    }

    const response: ApiResponse = {
      success: true,
      data: { id },
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
