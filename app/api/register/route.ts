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

// Registro deshabilitado por el administrador
export async function POST(request: Request) {
  return NextResponse.json({
    success: false,
    error: 'El registro de usuarios está deshabilitado. Contacta al administrador.'
  }, { status: 403 });
}
