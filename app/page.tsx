'use client';

import { useEffect, useState } from 'react';
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
import { Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle, LogOut, Calendar, Settings, LayoutGrid, List, User, Edit, FileText, Target, AlertTriangle, CalendarDays, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

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
  const [user, setUser] = useState<User | null>(null);
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
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

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
        setTasks(result.data);
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
        setAvailableUsers(result.data);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadTasks();
      checkCalendarStatus();
      loadUsers();
    }
  }, [user]);

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
        body: JSON.stringify(formData),
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
  };

  // Obtener color según el estado
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
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
        return 'text-blue-600';
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

  // Obtener color de borde según la prioridad
  const getPriorityBorderColor = (priority: TaskPriority): string => {
    switch (priority) {
      case 'urgent':
        return '#dc2626'; // red-600
      case 'high':
        return '#ea580c'; // orange-600
      case 'medium':
        return '#2563eb'; // blue-600
      case 'low':
        return '#9ca3af'; // gray-400
      default:
        return '#e5e7eb'; // gray-200
    }
  };

  // Obtener nombre del usuario asignado
  const getUserName = (userId: string | null): string => {
    if (!userId) return '';
    const foundUser = availableUsers.find(u => u.id === userId);
    return foundUser?.full_name || foundUser?.email || 'Usuario';
  };

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header con usuario y logout */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-medium">Usuario</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={openSettingsDialog}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Configuración
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Gestor de Tareas</h1>
          <p className="text-muted-foreground mt-2">Administra tus tareas de forma simple y eficiente</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
          <Plus className="w-5 h-5 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      {/* Toggle de vistas */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Mis Tareas</h2>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Tarjetas
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground mb-4">No tienes tareas creadas</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear primera tarea
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className="hover:shadow-lg transition-all border-l-4"
              style={{borderLeftColor: getPriorityBorderColor(task.priority)}}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg mb-2 truncate">{task.title}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className={getStatusColor(task.status)}>
                        {getStatusIcon(task.status)}
                        <span className="ml-1">{getStatusText(task.status)}</span>
                      </Badge>
                      <Badge variant="outline" className={getPriorityColor(task.priority)}>
                        {getPriorityText(task.priority)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(task)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(task.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {task.due_date && (() => {
                    const parsedDate = parseLocalDate(task.due_date);
                    if (!parsedDate) return null;
                    return (
                      <div className="flex items-center gap-2 col-span-2">
                        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">
                          {format(parsedDate, 'dd MMM yyyy', { locale: es })}
                        </span>
                      </div>
                    );
                  })()}
                  {task.time && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{task.time}</span>
                    </div>
                  )}
                  {task.assigned_to && (
                    <div className="flex items-center gap-2 col-span-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">
                        Asignada a: {getUserName(task.assigned_to)}
                      </span>
                    </div>
                  )}
                </div>
                {task.google_calendar_event_id && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                    <span>Sincronizada con Google Calendar</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarea</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="min-w-[200px]">
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(task.status)}>
                      {getStatusText(task.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={getPriorityColor(task.priority)}>
                      {getPriorityText(task.priority)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (() => {
                      const parsedDate = parseLocalDate(task.due_date);
                      if (!parsedDate) return '-';
                      return format(parsedDate, 'dd MMM yyyy', { locale: es });
                    })() : '-'}
                  </TableCell>
                  <TableCell>{task.time || '-'}</TableCell>
                  <TableCell>{getUserName(task.assigned_to) || '-'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditDialog(task)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(task.id)}>
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
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
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
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
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
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
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
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
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
                <Calendar className="w-5 h-5 text-blue-600" />
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
