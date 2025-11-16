import { pool } from '../lib/db';

async function fixDueDateType() {
  try {
    console.log('🔄 Iniciando migración para corregir tipo de columna due_date...');

    // Cambiar el tipo de columna due_date a date
    await pool.query(`
      ALTER TABLE tasks
      ALTER COLUMN due_date TYPE date USING due_date::date;
    `);

    console.log('✅ Migración completada exitosamente');
    console.log('   - La columna due_date ahora es de tipo date');
    console.log('   - Esto evita problemas de zona horaria');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar la migración:', error);
    process.exit(1);
  }
}

fixDueDateType();
