import { pool } from '../lib/db';

async function verifyTableStructure() {
  try {
    console.log('🔍 Verificando estructura de la tabla tasks...\n');

    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tasks'
      ORDER BY ordinal_position;
    `);

    console.log('Columnas de la tabla tasks:');
    console.log('─'.repeat(60));
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(30)} ${row.data_type.padEnd(20)} ${row.is_nullable}`);
    });
    console.log('─'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyTableStructure();
