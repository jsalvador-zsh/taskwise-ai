import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: taskId } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const { data: activities, error } = await supabase
      .from('task_activities')
      .select(`
        *,
        user:user_id (
          email,
          profiles (full_name)
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener actividades' }, { status: 500 });
    }

    // Aplanar la estructura del usuario para el componente
    const formattedActivities = activities.map((a: any) => ({
      ...a,
      user: {
        email: a.user.email,
        full_name: a.user.profiles?.full_name || null
      }
    }));

    return NextResponse.json({ success: true, data: formattedActivities });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
