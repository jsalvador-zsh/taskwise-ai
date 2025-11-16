-- Migración para cambiar el tipo de columna due_date de timestamp with time zone a date
-- Esto evita problemas de zona horaria al guardar fechas

BEGIN;

-- Cambiar el tipo de columna due_date a date
ALTER TABLE tasks
ALTER COLUMN due_date TYPE date USING due_date::date;

COMMIT;
