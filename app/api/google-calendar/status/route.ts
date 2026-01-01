import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { userHasCalendarAccess } from '@/lib/google-calendar';

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

    const hasAccess = await userHasCalendarAccess(user.id);

    return NextResponse.json({ connected: hasAccess });
  } catch (error) {
    console.error('Error al verificar estado de Google Calendar:', error);
    return NextResponse.json(
      { error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
