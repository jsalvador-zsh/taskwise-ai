-- ============================================
-- NEW FEATURES FOR TASKWISE AI
-- ============================================

-- Create Task Activities Table
CREATE TABLE IF NOT EXISTS task_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'created', 'status_changed', 'priority_changed', 'assigned', 'details_updated'
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by task
CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities(task_id);

-- Create Recurring Tasks Config Table
CREATE TABLE IF NOT EXISTS recurring_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  recurrence_interval INTEGER DEFAULT 1, -- every X days/weeks/months
  day_of_week INTEGER, -- 0-6 (domingo a sábado)
  day_of_month INTEGER, -- 1-31
  is_active BOOLEAN DEFAULT TRUE,
  next_execution_at TIMESTAMP WITH TIME ZONE,
  last_execution_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link tasks to their recurring source
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_config_id UUID REFERENCES recurring_configs(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_configs ENABLE ROW LEVEL SECURITY;

-- Poliza para actividades: usuarios ven actividades de tareas propias o asignadas
DROP POLICY IF EXISTS "Users can view activities of their tasks" ON task_activities;
CREATE POLICY "Users can view activities of their tasks"
  ON task_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_activities.task_id 
      AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid())
    )
  );

-- Poliza para que el sistema pueda insertar actividades
CREATE POLICY "Anyone can insert record" ON task_activities FOR INSERT WITH CHECK (true);

-- Polizas para configuraciones recurrentes
DROP POLICY IF EXISTS "Users can manage own recurring configs" ON recurring_configs;
CREATE POLICY "Users can manage own recurring configs"
  ON recurring_configs FOR ALL
  USING (auth.uid() = user_id);

-- Updated_at trigger for recurring_configs
DROP TRIGGER IF EXISTS update_recurring_configs_updated_at ON recurring_configs;
CREATE TRIGGER update_recurring_configs_updated_at
  BEFORE UPDATE ON recurring_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
