import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addDays, addWeeks, addMonths, isPast, parseISO } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    // Buscar configuraciones que necesiten ejecución
    const { data: configs, error } = await supabase
      .from('recurring_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('next_execution_at', new Date().toISOString());

    if (error) {
      console.error('Error fetching configs:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener configuraciones' }, { status: 500 });
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay tareas pendientes de procesar', total: 0 });
    }

    const generatedTasks = [];

    for (const config of configs) {
      // Crear la nueva tarea basada en la configuración
      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: config.title,
          description: config.description,
          priority: config.priority,
          assigned_to: config.assigned_to,
          status: 'pending',
          recurring_config_id: config.id
        })
        .select()
        .single();

      if (!taskError && newTask) {
        generatedTasks.push(newTask);

        // Calcular próxima ejecución
        let nextDate = new Date(config.next_execution_at);
        switch (config.frequency) {
          case 'daily':
            nextDate = addDays(nextDate, config.recurrence_interval);
            break;
          case 'weekly':
            nextDate = addWeeks(nextDate, config.recurrence_interval);
            break;
          case 'monthly':
            nextDate = addMonths(nextDate, config.recurrence_interval);
            break;
        }

        // Actualizar la configuración
        await supabase
          .from('recurring_configs')
          .update({
            last_execution_at: new Date().toISOString(),
            next_execution_at: nextDate.toISOString()
          })
          .eq('id', config.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Se han generado ${generatedTasks.length} nuevas tareas recurrentes`,
      total: generatedTasks.length
    });

  } catch (error) {
    console.error('Processor API Error:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function GET() {
  // Solo para listar configs del usuario
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { data } = await supabase
      .from('recurring_configs')
      .select('*')
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
