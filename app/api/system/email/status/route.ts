import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT email, created_at FROM system_email_tokens ORDER BY created_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        configured: false,
        email: null
      });
    }

    return NextResponse.json({
      configured: true,
      email: result.rows[0].email,
      configuredAt: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Error al verificar estado del sistema de email:', error);
    return NextResponse.json(
      { error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
