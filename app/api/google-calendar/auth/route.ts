import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAuthUrl } from '@/lib/google-calendar';

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user) {
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
