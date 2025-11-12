import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { UpdateTaskInput, ApiResponse, Task } from '@/lib/types';

// GET /api/tasks/[id] - Obtener una tarea por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      'SELECT * FROM tasks WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Tarea no encontrada',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<Task> = {
      success: true,
      data: result.rows[0],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al obtener tarea:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al obtener la tarea',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// PUT /api/tasks/[id] - Actualizar una tarea
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateTaskInput = await request.json();

    // Construir la query dinámicamente basado en los campos proporcionados
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (body.title !== undefined) {
      fields.push(`title = $${paramCount}`);
      values.push(body.title);
      paramCount++;
    }

    if (body.description !== undefined) {
      fields.push(`description = $${paramCount}`);
      values.push(body.description);
      paramCount++;
    }

    if (body.status !== undefined) {
      fields.push(`status = $${paramCount}`);
      values.push(body.status);
      paramCount++;

      // Si se marca como completada, actualizar completed_at
      if (body.status === 'completed') {
        fields.push(`completed_at = CURRENT_TIMESTAMP`);
      } else if (body.status !== 'completed') {
        fields.push(`completed_at = NULL`);
      }
    }

    if (body.priority !== undefined) {
      fields.push(`priority = $${paramCount}`);
      values.push(body.priority);
      paramCount++;
    }

    if (body.due_date !== undefined) {
      fields.push(`due_date = $${paramCount}`);
      values.push(body.due_date);
      paramCount++;
    }

    if (fields.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No se proporcionaron campos para actualizar',
      };
      return NextResponse.json(response, { status: 400 });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Tarea no encontrada',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<Task> = {
      success: true,
      data: result.rows[0],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al actualizar tarea:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al actualizar la tarea',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - Eliminar una tarea
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Tarea no encontrada',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      data: { id: result.rows[0].id },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al eliminar tarea:', error);

    const response: ApiResponse = {
      success: false,
      error: 'Error al eliminar la tarea',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
