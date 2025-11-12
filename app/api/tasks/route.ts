import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CreateTaskInput, ApiResponse, Task } from '@/lib/types';

// GET /api/tasks - Obtener todas las tareas
export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks ORDER BY created_at DESC'
    );

    const response: ApiResponse<Task[]> = {
      success: true,
      data: result.rows,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al obtener tareas:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al obtener las tareas',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// POST /api/tasks - Crear una nueva tarea
export async function POST(request: NextRequest) {
  try {
    const body: CreateTaskInput = await request.json();

    // Validación básica
    if (!body.title || body.title.trim() === '') {
      const response: ApiResponse = {
        success: false,
        error: 'El título es requerido',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO tasks (title, description, status, priority, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        body.title,
        body.description || null,
        body.status || 'pending',
        body.priority || 'medium',
        body.due_date || null,
      ]
    );

    const response: ApiResponse<Task> = {
      success: true,
      data: result.rows[0],
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error al crear tarea:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al crear la tarea',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
