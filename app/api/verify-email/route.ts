import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { z } from 'zod';

const verifySchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string().length(6, 'El código debe tener 6 dígitos'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar los datos
    const validationResult = verifySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { email, code } = validationResult.data;

    // Buscar el código de verificación
    const verificationResult = await pool.query(
      `SELECT id, name, password, expires_at, verified
       FROM email_verification_codes
       WHERE email = $1 AND code = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, code]
    );

    if (verificationResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Código de verificación inválido',
        },
        { status: 400 }
      );
    }

    const verification = verificationResult.rows[0];

    // Verificar si el código ya fue usado
    if (verification.verified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este código ya fue utilizado',
        },
        { status: 400 }
      );
    }

    // Verificar si el código expiró
    if (new Date(verification.expires_at) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'El código de verificación ha expirado. Por favor solicita uno nuevo.',
        },
        { status: 400 }
      );
    }

    // Iniciar transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Marcar el código como verificado
      await client.query(
        'UPDATE email_verification_codes SET verified = true WHERE id = $1',
        [verification.id]
      );

      // Crear el usuario
      const userResult = await client.query(
        `INSERT INTO users (name, email, password, email_verified)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, name, email, created_at`,
        [verification.name, email, verification.password]
      );

      const newUser = userResult.rows[0];

      // Commit de la transacción
      await client.query('COMMIT');

      return NextResponse.json(
        {
          success: true,
          message: 'Email verificado correctamente. Ya puedes iniciar sesión.',
          data: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            created_at: newUser.created_at,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en verificación:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al verificar el código. Por favor intenta nuevamente.',
      },
      { status: 500 }
    );
  }
}
