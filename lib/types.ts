// Tipos simplificados para TaskWise

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  time: string | null;
  google_calendar_event_id: string | null;
  user_id: string;
  assigned_to: string | null;
  assigned_to_email?: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  recurring_config_id?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  time?: string;
  assigned_to?: string; // UUID del usuario asignado
  is_recurring?: boolean;
  recurrence_data?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    day_of_week?: number;
    day_of_month?: number;
  };
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  time?: string;
  assigned_to?: string; // UUID del usuario asignado
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
