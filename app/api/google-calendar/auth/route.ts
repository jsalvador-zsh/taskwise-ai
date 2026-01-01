import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUrl } from '@/lib/google-calendar';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const authUrl = getAuthUrl();

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error al obtener URL de autenticación:', error);
    return NextResponse.json(
      { error: 'Error al obtener URL de autenticación' },
      { status: 500 }
    );
  }
}
