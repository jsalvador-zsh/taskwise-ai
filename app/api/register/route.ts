import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { z } from 'zod';
import { generateVerificationCode, sendVerificationEmail } from '@/lib/email';

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar los datos
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { name, email, password } = validationResult.data;

    // Verificar si el usuario ya existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'El email ya está registrado',
        },
        { status: 400 }
      );
    }

    // Verificar si ya existe un código de verificación pendiente
    const existingCode = await pool.query(
      'SELECT id FROM email_verification_codes WHERE email = $1 AND verified = false AND expires_at > NOW()',
      [email]
    );

    if (existingCode.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ya se envió un código de verificación a este email. Por favor revisa tu correo o espera 15 minutos para solicitar uno nuevo.',
        },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generar código de verificación
    const verificationCode = generateVerificationCode();

    // Guardar código de verificación (expira en 15 minutos)
    await pool.query(
      `INSERT INTO email_verification_codes (email, code, name, password, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 minutes')`,
      [email, verificationCode, name, hashedPassword]
    );

    // Enviar email de verificación
    try {
      await sendVerificationEmail(email, name, verificationCode);
      
      return NextResponse.json(
        {
          success: true,
          message: 'Se ha enviado un código de verificación a tu email. Por favor revisa tu correo.',
        },
        { status: 200 }
      );
    } catch (emailError) {
      // Si falla el envío del email, verificar si es un error de configuración
      const errorMessage = emailError instanceof Error ? emailError.message : 'Error desconocido';
      
      // Si es un error de configuración, dar un mensaje más claro
      if (errorMessage.includes('no está configurado') || 
          errorMessage.includes('no hay cuenta') ||
          errorMessage.includes('No hay cuenta')) {
        console.error('Error de configuración de email:', errorMessage);
        return NextResponse.json(
          {
            success: false,
            error: 'El sistema de verificación por email no está configurado. Por favor contacta al administrador.',
            details: 'El código de verificación ha sido generado pero no se pudo enviar el email.',
          },
          { status: 503 } // Service Unavailable
        );
      }
      
      // Para otros errores, lanzar el error para que se capture en el catch general
      throw emailError;
    }
  } catch (error) {
    console.error('Error en registro:', error);
    
    // Determinar si es un error conocido
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    // Si es un error de base de datos conocido
    if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
      return NextResponse.json(
        {
          success: false,
          error: 'El email ya está registrado o existe un código de verificación pendiente.',
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar el registro. Por favor intenta nuevamente.',
      },
      { status: 500 }
    );
  }
}
