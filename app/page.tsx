'use client';

import { useEffect, useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle, LogOut, Calendar, Settings, LayoutGrid, List, User, Edit, FileText, Target, AlertTriangle, CalendarDays, Mail, Kanban as KanbanIcon, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Nuevos componentes
import { TaskCard } from '@/components/TaskCard';
import { TaskFilters } from '@/components/TaskFilters';
import { KanbanBoard } from '@/components/KanbanBoard';
import { ProductivityAnalytics } from '@/components/ProductivityAnalytics';
import { ActivityLog } from '@/components/ActivityLog';
import { cn } from '@/lib/utils';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  ScrollArea
} from '@/components/ui/scroll-area';
import {
  History,
  RefreshCw,
  BarChart3,
  LayoutDashboard,
  CalendarCheck,
  MoreVertical,
  Repeat,
  ChevronDown
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// Función helper para parsear fechas tipo 'date' sin conversión UTC
function parseLocalDate(dateString: string | null): Date | null {
  if (!dateString) return null;

  try {
    // Extraer solo la parte de la fecha si viene en formato ISO completo
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);

    // Validar que todos los valores sean números válidos
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return null;
    }

    const date = new Date(year, month - 1, day);

    // Verificar que la fecha sea válida
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch (error) {
    return null;
  }
}

export default function TasksPage() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [checkingCalendar, setCheckingCalendar] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [calendarAccount, setCalendarAccount] = useState<{ email: string; summary: string } | null>(null);
  const [loadingCalendarInfo, setLoadingCalendarInfo] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'kanban'>('kanban');

  // Estados para filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Estados para nuevas funcionalidades
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activeActivityTaskId, setActiveActivityTaskId] = useState<string | null>(null);
  const [isRecurringMode, setIsRecurringMode] = useState(false);

  // Estado para recurrencia en el formulario
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState({
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    interval: 1,
    day_of_week: 0,
    day_of_month: 1
  });

  // Formulario
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending' as TaskStatus,
    priority: 'medium' as TaskPriority,
    due_date: '',
    time: '',
    assigned_to: '',
  });

  // Lista de usuarios disponibles para asignación
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; email: string; full_name: string | null }>>([]);

  // Verificar autenticación con Supabase
  useEffect(() => {
    const supabase = createClient();

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
    };

    checkUser();

    // Suscribirse a cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Cargar tareas
  const loadTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const result = await response.json();

      if (result.success) {
        setTasks(result.data || []);
      } else {
        toast.error(result.error || 'Error al cargar tareas');
      }
    } catch (error) {
      toast.error('Error al cargar tareas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar usuarios disponibles para asignación
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const result = await response.json();

      if (result.success) {
        setAvailableUsers(result.data || []);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const [recurringConfigs, setRecurringConfigs] = useState<any[]>([]);
  const [processingRecurrence, setProcessingRecurrence] = useState(false);

  useEffect(() => {
    if (user) {
      loadTasks();
      checkCalendarStatus();
      loadUsers();
      loadRecurringConfigs(); // Cargar configuraciones al inicio
    }
  }, [user]);

  const loadRecurringConfigs = async () => {
    try {
      const response = await fetch('/api/recurring-tasks');
      const result = await response.json();
      if (result.success) setRecurringConfigs(result.data || []);
    } catch (error) {
      console.error('Error al cargar recurrencias:', error);
    }
  };

  const processRecurringTasks = async () => {
    setProcessingRecurrence(true);
    try {
      const response = await fetch('/api/recurring-tasks', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        loadTasks(); // Recargar tareas si se generaron nuevas
        loadRecurringConfigs(); // Actualizar fechas
      }
    } catch (error) {
      toast.error('Error al procesar automatizaciones');
    } finally {
      setProcessingRecurrence(false);
    }
  };

  // Supabase Realtime - Suscribirse a cambios en tareas
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();

    // Handler para eventos de tareas
    const handleTaskEvent = (payload: any, isAssigned: boolean = false) => {
      console.log('Realtime event:', payload);

      if (payload.eventType === 'INSERT') {
        setTasks((prev) => {
          // Evitar duplicados
          if (prev.some(t => t.id === payload.new.id)) return prev;
          return [payload.new as Task, ...prev];
        });
        toast.success(isAssigned ? 'Te han asignado una nueva tarea' : 'Nueva tarea creada');
      } else if (payload.eventType === 'UPDATE') {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === payload.new.id ? (payload.new as Task) : task
          )
        );
        toast.info('Tarea actualizada');
      } else if (payload.eventType === 'DELETE') {
        setTasks((prev) => prev.filter((task) => task.id !== payload.old.id));
        toast.info('Tarea eliminada');
      }
    };

    // Suscripción para tareas creadas por el usuario
    const channelOwned = supabase
      .channel('tasks-owned')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => handleTaskEvent(payload, false)
      )
      .subscribe();

    // Suscripción para tareas asignadas al usuario
    const channelAssigned = supabase
      .channel('tasks-assigned')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => handleTaskEvent(payload, true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelOwned);
      supabase.removeChannel(channelAssigned);
    };
  }, [user]);

  // Verificar estado de conexión con Google Calendar
  const checkCalendarStatus = async () => {
    try {
      const response = await fetch('/api/google-calendar/status');
      const result = await response.json();
      setCalendarConnected(result.connected);
    } catch (error) {
      console.error('Error al verificar estado de Google Calendar:', error);
    } finally {
      setCheckingCalendar(false);
    }
  };

  // Conectar con Google Calendar
  const connectCalendar = async () => {
    try {
      const response = await fetch('/api/google-calendar/auth');
      const result = await response.json();
      if (result.authUrl) {
        window.location.href = result.authUrl;
      }
    } catch (error) {
      console.error('Error al conectar Google Calendar:', error);
      toast.error('Error al conectar con Google Calendar');
    }
  };

  // Cargar información de la cuenta de Google Calendar
  const loadCalendarAccount = async () => {
    setLoadingCalendarInfo(true);
    try {
      const response = await fetch('/api/google-calendar/account');
      const result = await response.json();
      if (result.success && result.account) {
        setCalendarAccount(result.account);
      } else {
        setCalendarAccount(null);
      }
    } catch (error) {
      console.error('Error al cargar cuenta de Google Calendar:', error);
      setCalendarAccount(null);
    } finally {
      setLoadingCalendarInfo(false);
    }
  };

  // Desconectar Google Calendar
  const disconnectCalendar = async () => {
    try {
      const response = await fetch('/api/google-calendar/disconnect', {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        toast.success('Google Calendar desconectado exitosamente');
        setCalendarConnected(false);
        setCalendarAccount(null);
        loadTasks(); // Recargar tareas para actualizar indicadores
      } else {
        toast.error(result.error || 'Error al desconectar');
      }
    } catch (error) {
      console.error('Error al desconectar Google Calendar:', error);
      toast.error('Error al desconectar Google Calendar');
    }
  };

  // Abrir modal de configuración
  const openSettingsDialog = () => {
    setIsSettingsDialogOpen(true);
    if (calendarConnected) {
      loadCalendarAccount();
    }
  };

  // Crear tarea
  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          is_recurring: isRecurring,
          recurrence_data: isRecurring ? recurrenceData : undefined
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Tarea creada exitosamente');
        setIsCreateDialogOpen(false);
        resetForm();
        loadTasks();
      } else {
        toast.error(result.error || 'Error al crear tarea');
      }
    } catch (error) {
      toast.error('Error al crear tarea');
      console.error(error);
    }
  };

  // Actualizar tarea
  const handleUpdate = async () => {
    if (!editingTask) return;

    try {
      const response = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Tarea actualizada exitosamente');
        setIsEditDialogOpen(false);
        setEditingTask(null);
        resetForm();
        loadTasks();
      } else {
        toast.error(result.error || 'Error al actualizar tarea');
      }
    } catch (error) {
      toast.error('Error al actualizar tarea');
      console.error(error);
    }
  };

  // Eliminar tarea
  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta tarea?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Tarea eliminada exitosamente');
        loadTasks();
      } else {
        toast.error(result.error || 'Error al eliminar tarea');
      }
    } catch (error) {
      toast.error('Error al eliminar tarea');
      console.error(error);
    }
  };

  // Abrir diálogo de edición
  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '', // Ya está en formato yyyy-MM-dd, no necesita conversión
      time: task.time || '',
      assigned_to: task.assigned_to || '',
    });
    setIsEditDialogOpen(true);
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      due_date: '',
      time: '',
      assigned_to: '',
    });
    setIsRecurring(false);
    setRecurrenceData({
      frequency: 'daily',
      interval: 1,
      day_of_week: 0,
      day_of_month: 1
    });
  };

  // Obtener color según el estado
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  // Obtener icono según el estado
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Obtener texto del estado
  const getStatusText = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'in_progress':
        return 'En progreso';
      case 'cancelled':
        return 'Cancelada';
      default:
        return 'Pendiente';
    }
  };

  // Obtener color según la prioridad
  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 font-bold';
      case 'high':
        return 'text-orange-600 font-semibold';
      case 'low':
        return 'text-gray-500';
      default:
        return 'text-teal-600';
    }
  };

  // Obtener texto de la prioridad
  const getPriorityText = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return 'Urgente';
      case 'high':
        return 'Alta';
      case 'low':
        return 'Baja';
      default:
        return 'Media';
    }
  };

  // Lógica de filtrado de tareas
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

  // Handler para mover tareas en Kanban
  const handleTaskMove = async (taskId: string, newStatus: TaskStatus) => {
    // Actualización optimista de la UI
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();
      if (!result.success) {
        setTasks(originalTasks);
        toast.error('Error al actualizar el estado');
      } else {
        toast.success(`Tarea movida a ${getStatusText(newStatus)}`);
      }
    } catch (error) {
      setTasks(originalTasks);
      toast.error('Error de red al actualizar');
    }
  };

  // Abrir diálogo de creación con estado predefinido
  const openCreateWithStatus = (status: TaskStatus) => {
    resetForm();
    setFormData(prev => ({ ...prev, status }));
    setIsCreateDialogOpen(true);
  };

  // Obtener nombre del usuario asignado
  const getUserName = (userId: string | null): string => {
    if (!userId) return '';
    const foundUser = availableUsers.find(u => u.id === userId);
    return foundUser?.full_name || foundUser?.email || 'Usuario';
  };

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500 animate-pulse">Cargando Taskwise AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50/30 overflow-hidden">
      {/* Navbar Superior */}
      <header className="h-16 border-b bg-white/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-200">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">Taskwise <span className="text-emerald-600">AI</span></h1>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <nav className="flex items-center gap-1">
            <Button
              variant={!isRecurringMode ? "secondary" : "ghost"}
              size="sm"
              className="rounded-lg font-bold text-xs px-4"
              onClick={() => setIsRecurringMode(false)}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Tablero
            </Button>
            <Button
              variant={isRecurringMode ? "secondary" : "ghost"}
              size="sm"
              className="rounded-lg font-bold text-xs px-4"
              onClick={() => setIsRecurringMode(true)}
            >
              <Repeat className="w-4 h-4 mr-2" />
              Recurrentes
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 border rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-inner">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-none mb-0.5 truncate max-w-[120px]">
                {user?.email?.split('@')[0]}
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-none truncate max-w-[120px]">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={openSettingsDialog} className="rounded-xl h-10 w-10 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50">
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="rounded-xl h-10 w-10 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="w-full max-w-[1700px] mx-auto p-8 pt-6">

            {/* Cabecera / Analíticas */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    {isRecurringMode ? (
                      <>
                        <RefreshCw className="w-6 h-6 text-emerald-600" />
                        Automatización de Tareas
                      </>
                    ) : (
                      <>
                        <LayoutDashboard className="w-6 h-6 text-emerald-600" />
                        Mi Tablero de Productividad
                      </>
                    )}
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">
                    {isRecurringMode
                      ? "Configura tareas que se crean automáticamente según un horario."
                      : "Visualiza y gestiona todas tus actividades con un solo vistazo."}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 border rounded-xl shadow-sm">
                    <span className="text-xs font-bold text-slate-500">Métricas</span>
                    <Switch
                      checked={showAnalytics}
                      onCheckedChange={setShowAnalytics}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                  </div>
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 h-11 px-6 font-bold"
                  >
                    <Plus className="w-5 h-5 mr-1" />
                    {isRecurringMode ? "Nueva Recurrencia" : "Nueva Tarea"}
                  </Button>
                </div>
              </div>

              {showAnalytics && !isRecurringMode && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <ProductivityAnalytics tasks={tasks} />
                </div>
              )}
            </div>

            {!isRecurringMode ? (
              <div className="flex flex-col gap-8">
                {/* Controles y Filtros */}
                <div className="bg-white/40 backdrop-blur-sm p-4 rounded-3xl border border-slate-200/60 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Gestión de Tareas</h3>
                    </div>
                    <div className="bg-slate-200/50 p-1 rounded-xl flex gap-1">
                      <Button
                        variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('kanban')}
                        className={cn("rounded-lg h-8 px-4 text-xs font-bold", viewMode === 'kanban' && "bg-white text-emerald-600 shadow-sm hover:bg-white")}
                      >
                        Kanban
                      </Button>
                      <Button
                        variant={viewMode === 'card' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('card')}
                        className={cn("rounded-lg h-8 px-4 text-xs font-bold", viewMode === 'card' && "bg-white text-emerald-600 shadow-sm hover:bg-white")}
                      >
                        Cuadrícula
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className={cn("rounded-lg h-8 px-4 text-xs font-bold", viewMode === 'list' && "bg-white text-emerald-600 shadow-sm hover:bg-white")}
                      >
                        Lista
                      </Button>
                    </div>
                  </div>

                  <TaskFilters
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    priorityFilter={priorityFilter}
                    setPriorityFilter={setPriorityFilter}
                    onClear={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setPriorityFilter('all');
                    }}
                  />
                </div>

                {/* Contenido Dinámico */}
                <div className="min-h-[500px]">
                  {tasks.length === 0 && !loading ? (
                    <Card className="border-dashed border-2 bg-slate-50/50 rounded-[40px] py-16">
                      <CardContent className="flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6">
                          <FileText className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Sin tareas todavía</h3>
                        <p className="text-slate-500 mb-8 max-w-xs text-center font-medium">Empieza a organizar tu jornada creando tu primera tarea.</p>
                        <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-2xl h-12 px-8 bg-emerald-600 font-bold">
                          Crear primera tarea
                        </Button>
                      </CardContent>
                    </Card>
                  ) : filteredTasks.length === 0 ? (
                    <div className="py-24 text-center bg-slate-50/50 rounded-[40px] border border-dashed border-slate-300">
                      <p className="text-slate-500 font-bold text-lg">No hay coincidencias</p>
                      <p className="text-slate-400 text-sm mt-1 mb-6">Prueba a usar otros términos o filtros.</p>
                      <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPriorityFilter('all'); }} className="rounded-xl">
                        Limpiar filtros
                      </Button>
                    </div>
                  ) : viewMode === 'kanban' ? (
                    <KanbanBoard
                      tasks={filteredTasks}
                      onTaskMove={handleTaskMove}
                      onEdit={openEditDialog}
                      onDelete={handleDelete}
                      onAddTask={openCreateWithStatus}
                      getUserName={getUserName}
                      currentUserId={user?.id}
                    />
                  ) : viewMode === 'card' ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={openEditDialog}
                          onDelete={handleDelete}
                          getUserName={getUserName}
                          currentUserId={user?.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-[32px] overflow-hidden bg-white shadow-xl shadow-slate-200/50">
                      <Table>
                        <TableHeader className="bg-slate-50/80">
                          <TableRow className="hover:bg-transparent border-b-2">
                            <TableHead className="font-black text-slate-900 h-12">Actividad</TableHead>
                            <TableHead className="font-black text-slate-900 h-12">Estado</TableHead>
                            <TableHead className="font-black text-slate-900 h-12">Prioridad</TableHead>
                            <TableHead className="font-black text-slate-900 h-12">Vencimiento</TableHead>
                            <TableHead className="font-black text-slate-900 h-12">Responsable</TableHead>
                            <TableHead className="text-right font-black text-slate-900 h-12">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTasks.map((task) => (
                            <TableRow key={task.id} className="hover:bg-slate-50/50 transition-colors h-16">
                              <TableCell>
                                <div className="max-w-[300px]">
                                  <p className="font-bold text-slate-900 truncate leading-tight">{task.title}</p>
                                  {task.description && (
                                    <p className="text-[10px] text-slate-400 line-clamp-1 italic mt-0.5">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full ring-4 ring-opacity-20",
                                    task.status === 'completed' ? "bg-emerald-500 ring-emerald-500" :
                                      task.status === 'in_progress' ? "bg-teal-500 ring-teal-500" :
                                        task.status === 'cancelled' ? "bg-slate-400 ring-slate-400" : "bg-amber-500 ring-amber-500"
                                  )} />
                                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{getStatusText(task.status)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-100", getPriorityColor(task.priority))}>
                                  {getPriorityText(task.priority)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                  {task.due_date ? (() => {
                                    const parsedDate = parseLocalDate(task.due_date);
                                    if (!parsedDate) return '-';
                                    return format(parsedDate, 'dd MMM yyyy', { locale: es });
                                  })() : '-'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 border flex items-center justify-center">
                                    <User className="w-3 h-3 text-slate-400" />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-700">{getUserName(task.assigned_to) || 'Yo'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => { setActiveActivityTaskId(task.id); setIsActivityLogOpen(true); }} className="h-8 w-8 text-slate-400 hover:text-emerald-600">
                                    <History className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => openEditDialog(task)} className="h-8 w-8 text-slate-400 hover:text-emerald-600">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDelete(task.id)} className="h-8 w-8 text-slate-400 hover:text-rose-600">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
                <div className="bg-emerald-600/5 backdrop-blur-sm p-6 rounded-[28px] border border-emerald-200/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-emerald-100">
                      <Repeat className="w-6 h-6 text-emerald-600 animate-spin-slow" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-emerald-900 uppercase">Motor de Recurrencia</h3>
                      <p className="text-[11px] text-emerald-600 font-bold opacity-70">Detecta y genera tareas automáticamente.</p>
                    </div>
                  </div>
                  <Button
                    onClick={processRecurringTasks}
                    disabled={processingRecurrence}
                    className="rounded-xl bg-emerald-600 font-bold h-10 px-5 shadow-lg shadow-emerald-100 flex items-center gap-2"
                  >
                    {processingRecurrence ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Procesar Pendientes
                  </Button>
                </div>

                {(recurringConfigs || []).length === 0 ? (
                  <div className="bg-white/50 border border-slate-200 rounded-[40px] p-20 text-center">
                    <div className="w-24 h-24 bg-emerald-50 rounded-[32px] flex items-center justify-center mx-auto mb-8">
                      <Repeat className="w-12 h-12 text-emerald-600" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4">Automatiza tu rutina</h2>
                    <p className="text-slate-500 max-w-lg mx-auto mb-10 text-lg font-medium">Configura tareas repetitivas para que Taskwise AI las cree por ti automáticamente.</p>
                    <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-2xl h-14 px-10 bg-emerald-600 text-lg font-bold shadow-2xl shadow-emerald-200">
                      Crear Mi Primera Automatización
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(recurringConfigs || []).map((config) => (
                      <Card key={config.id} className="bg-white/70 backdrop-blur-sm border-slate-200/60 rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-emerald-50 transition-all duration-300">
                        <div className="h-1 w-full bg-emerald-500" />
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                              {config.frequency === 'daily' ? 'Diario' : config.frequency === 'weekly' ? 'Semanal' : 'Mensual'}
                            </span>
                            <span className={cn("text-[10px] font-black uppercase", config.is_active ? "text-emerald-600" : "text-slate-400")}>
                              {config.is_active ? 'Activo' : 'Pausado'}
                            </span>
                          </div>
                          <h4 className="font-black text-slate-900 mb-2 truncate">{config.title}</h4>
                          <div className="space-y-3 mt-4">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-slate-400">Cada</span>
                              <span className="text-slate-900">{config.recurrence_interval} {config.frequency === 'daily' ? 'días' : config.frequency === 'weekly' ? 'semanas' : 'meses'}</span>
                            </div>
                            <Separator className="bg-slate-100" />
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Próxima
                              </span>
                              <span className="text-emerald-600">
                                {config.next_execution_at ? format(new Date(config.next_execution_at), "d 'de' MMM", { locale: es }) : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-6 flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-9">
                              Editar
                            </Button>
                            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-rose-500 hover:bg-rose-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      <Dialog open={isActivityLogOpen} onOpenChange={setIsActivityLogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Historial de Actividad</DialogTitle>
            <DialogDescription>
              Consulta los cambios y actualizaciones realizados en esta tarea.
            </DialogDescription>
          </DialogHeader>
          {activeActivityTaskId && <ActivityLog taskId={activeActivityTaskId} />}
          <div className="p-4 bg-white border-t flex justify-end">
            <Button onClick={() => setIsActivityLogOpen(false)} className="rounded-xl font-bold">Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de crear tarea */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Plus className="h-6 w-6 text-primary" />
              Crear Nueva Tarea
            </DialogTitle>
            <DialogDescription>Completa la información para crear una nueva tarea</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Información Básica */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>INFORMACIÓN BÁSICA</span>
              </div>

              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                    <span>Título</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Revisar propuesta de proyecto..."
                    className="text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Agrega detalles sobre la tarea..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Clasificación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>CLASIFICACIÓN</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Estado
                  </Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-gray-500" />
                          Pendiente
                        </div>
                      </SelectItem>
                      <SelectItem value="in_progress">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-teal-500" />
                          En progreso
                        </div>
                      </SelectItem>
                      <SelectItem value="completed">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          Completada
                        </div>
                      </SelectItem>
                      <SelectItem value="cancelled">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                          Cancelada
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Prioridad
                  </Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-gray-400" />
                          Baja
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-teal-500" />
                          Media
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-orange-500" />
                          Alta
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-600" />
                          Urgente
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Programación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>PROGRAMACIÓN</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="due_date" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Fecha de vencimiento
                  </Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Hora
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    placeholder="HH:MM"
                    className="text-base"
                  />
                </div>
              </div>

              <div className="pl-6">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />
                  Se creará un evento de 1 hora en Google Calendar si está conectado
                </p>
              </div>
            </div>

            <Separator />

            {/* Asignación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <User className="h-4 w-4" />
                <span>ASIGNACIÓN</span>
              </div>

              <div className="space-y-2 pl-6">
                <Label htmlFor="assigned_to" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  Asignar a usuario
                </Label>
                <Select value={formData.assigned_to || "none"} onValueChange={(value) => setFormData({ ...formData, assigned_to: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        Sin asignar
                      </div>
                    </SelectItem>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" />
                          {user.full_name || user.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  Se enviará una notificación por email al usuario asignado
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Crear Tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de editar tarea */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Edit className="h-6 w-6 text-primary" />
              Editar Tarea
            </DialogTitle>
            <DialogDescription>Modifica la información de la tarea</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Información Básica */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>INFORMACIÓN BÁSICA</span>
              </div>

              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-title" className="text-sm font-medium flex items-center gap-2">
                    <span>Título</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Revisar propuesta de proyecto..."
                    className="text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description" className="text-sm font-medium">Descripción</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Agrega detalles sobre la tarea..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Clasificación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>CLASIFICACIÓN</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-status" className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Estado
                  </Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-gray-500" />
                          Pendiente
                        </div>
                      </SelectItem>
                      <SelectItem value="in_progress">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-teal-500" />
                          En progreso
                        </div>
                      </SelectItem>
                      <SelectItem value="completed">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          Completada
                        </div>
                      </SelectItem>
                      <SelectItem value="cancelled">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                          Cancelada
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-priority" className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Prioridad
                  </Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-gray-400" />
                          Baja
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-teal-500" />
                          Media
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-orange-500" />
                          Alta
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-600" />
                          Urgente
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Programación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>PROGRAMACIÓN</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-due_date" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Fecha de vencimiento
                  </Label>
                  <Input
                    id="edit-due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-time" className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Hora
                  </Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    placeholder="HH:MM"
                    className="text-base"
                  />
                </div>
              </div>

              <div className="pl-6">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />
                  Se actualizará el evento en Google Calendar si está conectado
                </p>
              </div>
            </div>

            <Separator />

            {/* Asignación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <User className="h-4 w-4" />
                <span>ASIGNACIÓN</span>
              </div>

              <div className="space-y-2 pl-6">
                <Label htmlFor="edit-assigned_to" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  Asignar a usuario
                </Label>
                <Select value={formData.assigned_to || "none"} onValueChange={(value) => setFormData({ ...formData, assigned_to: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        Sin asignar
                      </div>
                    </SelectItem>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" />
                          {user.full_name || user.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  Se enviará una notificación por email al usuario asignado
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingTask(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuración */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configuración</DialogTitle>
            <DialogDescription>
              Gestiona la integración con Google Calendar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sección de Google Calendar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-lg">Google Calendar</h3>
              </div>

              {checkingCalendar ? (
                <p className="text-sm text-muted-foreground">Verificando conexión...</p>
              ) : calendarConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <p className="text-sm font-medium">Conectado</p>
                  </div>

                  {loadingCalendarInfo ? (
                    <p className="text-sm text-muted-foreground">Cargando información...</p>
                  ) : calendarAccount ? (
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <p className="text-sm font-medium">Cuenta vinculada:</p>
                      <p className="text-sm text-muted-foreground">{calendarAccount.email}</p>
                      {calendarAccount.summary && (
                        <p className="text-xs text-muted-foreground">{calendarAccount.summary}</p>
                      )}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Las tareas con fecha y hora se sincronizan automáticamente con tu Google Calendar.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={disconnectCalendar}
                        className="gap-2"
                      >
                        Desconectar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={connectCalendar}
                        className="gap-2"
                      >
                        Reconectar con otra cuenta
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <p className="text-sm font-medium">No conectado</p>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Conecta tu Google Calendar para sincronizar automáticamente tus tareas con eventos.
                  </p>

                  <Button
                    onClick={connectCalendar}
                    className="gap-2 w-full"
                  >
                    <Calendar className="w-4 h-4" />
                    Conectar Google Calendar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsSettingsDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
