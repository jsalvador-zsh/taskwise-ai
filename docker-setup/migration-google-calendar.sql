-- Migración para agregar hora a las tareas e integración con Google Calendar

-- Agregar campo de hora a las tareas
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time TIME;

-- Agregar campo para almacenar el ID del evento de Google Calendar
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS google_calendar_event_id VARCHAR(255);

-- Agregar índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_tasks_google_calendar_event_id ON tasks(google_calendar_event_id);

-- Tabla para almacenar tokens de Google Calendar por usuario
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Índice para búsquedas por usuario
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id ON google_calendar_tokens(user_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_google_calendar_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_calendar_tokens_updated_at_trigger
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_calendar_tokens_updated_at();

-- Permisos
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taskwise_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taskwise_user;
