import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// GET /api/users - Obtener lista de usuarios para asignación de tareas
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

    // Usar admin client para obtener todos los usuarios
    const adminClient = getSupabaseAdmin();
    const { data: authData, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error('Error al listar usuarios:', listError);
      return NextResponse.json(
        { success: false, error: 'Error al obtener usuarios' },
        { status: 500 }
      );
    }

    // Filtrar el usuario actual y obtener sus profiles
    const otherUsers = authData.users.filter(u => u.id !== user.id);

    // Obtener profiles para enriquecer la información
    const usersWithProfiles = await Promise.all(
      otherUsers.map(async (authUser) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', authUser.id)
          .maybeSingle();

        return {
          id: authUser.id,
          email: authUser.email || '',
          full_name: profile?.full_name || null
        };
      })
    );

    // Ordenar por email
    const users = usersWithProfiles.sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}
