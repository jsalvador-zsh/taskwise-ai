import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Ejecutando migración de nuevas funcionalidades...');
    const migrationPath = join(process.cwd(), 'supabase', 'new_features.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    await client.query(sql);
    console.log('✅ Migración de nuevas funcionalidades completada exitosamente');
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
