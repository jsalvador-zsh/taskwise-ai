import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { userHasCalendarAccess } from '@/lib/google-calendar';

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const hasAccess = await userHasCalendarAccess(session.user.id);

    return NextResponse.json({ connected: hasAccess });
  } catch (error) {
    console.error('Error al verificar estado de Google Calendar:', error);
    return NextResponse.json(
      { error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
