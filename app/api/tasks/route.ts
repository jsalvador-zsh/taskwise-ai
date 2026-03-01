import { NextRequest, NextResponse } from 'next/server';
import { CreateTaskInput, ApiResponse, Task } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import { createCalendarEvent, userHasCalendarAccess } from '@/lib/google-calendar';
import { sendTaskAssignmentEmail } from '@/lib/email-sender';

// GET /api/tasks - Obtener todas las tareas del usuario autenticado
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

    // Supabase RLS automáticamente filtra por user_id y assigned_to
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener tareas:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener las tareas' },
        { status: 500 }
      );
    }

    const response: ApiResponse<Task[]> = {
      success: true,
      data: tasks || [],
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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body: CreateTaskInput = await request.json();

    console.log('📝 Datos recibidos para crear tarea:', {
      title: body.title,
      due_date: body.due_date,
      time: body.time,
      assigned_to: body.assigned_to,
    });

    // Validación básica
    if (!body.title || body.title.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'El título es requerido' },
        { status: 400 }
      );
    }

    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        title: body.title,
        description: body.description || null,
        status: body.status || 'pending',
        priority: body.priority || 'medium',
        due_date: body.due_date || null,
        time: body.time || null,
        user_id: user.id,
        assigned_to: body.assigned_to || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear tarea:', error);
      return NextResponse.json(
        { success: false, error: 'Error al crear la tarea' },
        { status: 500 }
      );
    }

    // Registrar actividad de creación
    await supabase.from('task_activities').insert({
      task_id: newTask.id,
      user_id: user.id,
      activity_type: 'created',
      new_value: newTask.title
    });

    // Manejar configuración recurrente si se solicita
    if (body.is_recurring && body.recurrence_data) {
      const { data: recConfig, error: recError } = await supabase
        .from('recurring_configs')
        .insert({
          user_id: user.id,
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          assigned_to: newTask.assigned_to,
          frequency: body.recurrence_data.frequency,
          recurrence_interval: body.recurrence_data.interval,
          day_of_week: body.recurrence_data.day_of_week,
          day_of_month: body.recurrence_data.day_of_month,
          next_execution_at: new Date().toISOString() // Simplificado para este ejemplo
        })
        .select()
        .single();

      if (!recError && recConfig) {
        await supabase
          .from('tasks')
          .update({ recurring_config_id: recConfig.id })
          .eq('id', newTask.id);

        newTask.recurring_config_id = recConfig.id;
      }
    }

    console.log('💾 Tarea guardada en DB:', {
      id: newTask.id,
      title: newTask.title,
      due_date: newTask.due_date,
      time: newTask.time,
      assigned_to: newTask.assigned_to,
    });

    // Enviar notificación por email si la tarea fue asignada
    if (newTask.assigned_to) {
      try {
        // Obtener los perfiles del creador y del asignado
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();

        const { data: assignedProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', newTask.assigned_to)
          .single();

        if (assignedProfile?.email) {
          const assignedBy = creatorProfile?.full_name || creatorProfile?.email || 'Un usuario';
          const taskUrl = `${process.env.NEXT_PUBLIC_APP_URL}`;

          await sendTaskAssignmentEmail({
            to: assignedProfile.email,
            taskTitle: newTask.title,
            taskDescription: newTask.description || undefined,
            dueDate: newTask.due_date || undefined,
            assignedBy,
            taskUrl,
          });

          console.log('✅ Email de asignación enviado a:', assignedProfile.email);
        }
      } catch (emailError) {
        console.error('❌ Error al enviar email de asignación:', emailError);
        // No fallar la creación de la tarea si falla el envío del email
      }
    }

    // Sincronizar con Google Calendar si el usuario tiene acceso
    if (newTask.due_date) {
      try {
        console.log('📅 Verificando acceso a Google Calendar para usuario:', user.id);
        const hasCalendarAccess = await userHasCalendarAccess(user.id);
        console.log('📅 ¿Tiene acceso a Calendar?:', hasCalendarAccess);

        if (hasCalendarAccess) {
          // Obtener email del asignado para invitarlo
          const attendees = [];
          if (newTask.assigned_to) {
            const { data: assignedProf } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', newTask.assigned_to)
              .single();
            if (assignedProf?.email) attendees.push(assignedProf.email);
          }

          console.log('📅 Creando evento en Google Calendar con asistentes:', attendees);
          const eventId = await createCalendarEvent(
            user.id,
            newTask.title,
            newTask.description || '',
            newTask.due_date,
            newTask.time,
            attendees
          );

          console.log('📅 Evento creado con ID:', eventId);

          // Actualizar la tarea con el ID del evento de Google Calendar
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ google_calendar_event_id: eventId })
            .eq('id', newTask.id);

          if (!updateError) {
            newTask.google_calendar_event_id = eventId;
            console.log('✅ Evento sincronizado correctamente con ID:', eventId);
          } else {
            console.error('❌ Error al actualizar tarea con event_id:', updateError);
          }
        } else {
          console.log('⚠️ Usuario no tiene acceso a Google Calendar');
        }
      } catch (calendarError: any) {
        console.error('❌ Error al sincronizar con Google Calendar:', calendarError?.message);
        console.error('❌ Stack trace:', calendarError?.stack);
        // No fallar la creación de la tarea si falla la sincronización
      }
    } else {
      console.log('⚠️ Tarea sin fecha de vencimiento, no se sincroniza con Calendar');
    }

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
