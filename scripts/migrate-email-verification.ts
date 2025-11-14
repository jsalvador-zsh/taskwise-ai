import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Ejecutando migración de verificación de email...');

    const migrationPath = join(process.cwd(), 'docker-setup', 'migration-email-verification.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    await client.query(sql);

    console.log('✅ Migración de verificación de email completada exitosamente');
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
