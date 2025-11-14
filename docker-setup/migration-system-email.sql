-- Migración para agregar tokens de email del sistema

-- Tabla para almacenar tokens de Gmail para el sistema (cuenta que envía emails)
CREATE TABLE IF NOT EXISTS system_email_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_system_email_tokens_email ON system_email_tokens(email);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_system_email_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_email_tokens_updated_at_trigger
  BEFORE UPDATE ON system_email_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_system_email_tokens_updated_at();

-- Permisos
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taskwise_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taskwise_user;
