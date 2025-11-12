-- Base de datos TaskWise - Esquema Simplificado
-- Solo tabla de tareas sin autenticación

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de tareas simplificada
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Datos de ejemplo (opcional)
INSERT INTO tasks (title, description, status, priority, due_date) VALUES
  ('Tarea de ejemplo 1', 'Esta es una tarea de prueba', 'pending', 'medium', CURRENT_TIMESTAMP + INTERVAL '2 days'),
  ('Tarea de ejemplo 2', 'Otra tarea de prueba', 'in_progress', 'high', CURRENT_TIMESTAMP + INTERVAL '1 day'),
  ('Tarea completada', 'Esta tarea ya está completada', 'completed', 'low', CURRENT_TIMESTAMP - INTERVAL '1 day');

-- Permisos
GRANT ALL PRIVILEGES ON DATABASE taskwise_db TO taskwise_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taskwise_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taskwise_user;
