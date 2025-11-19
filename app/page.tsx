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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle, LogOut, Calendar, Settings } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';

// Función helper para parsear fechas tipo 'date' sin conversión UTC
function parseLocalDate(dateString: string | null): Date | null {
  if (!dateString) return null;

  try {
    const [year, month, day] = dateString.split('-').map(Number);

    // Validar que todos los valores sean números válidos
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.error('Invalid date components:', { year, month, day, dateString });
      return null;
    }

    const date = new Date(year, month - 1, day);

    // Verificar que la fecha sea válida
    if (isNaN(date.getTime())) {
      console.error('Invalid date created:', dateString);
      return null;
    }

    return date;
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
}

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
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

  // Formulario
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending' as TaskStatus,
    priority: 'medium' as TaskPriority,
    due_date: '',
    time: '',
  });

  // Redirigir a login si no está autenticado
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Socket.io para actualizaciones en tiempo real
  useSocket(
    // onTaskCreated
    (task: Task) => {
      setTasks((prevTasks) => [task, ...prevTasks]);
      toast.success('Nueva tarea creada');
    },
    // onTaskUpdated
    (task: Task) => {
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === task.id ? task : t))
      );
      toast.info('Tarea actualizada');
    },
    // onTaskDeleted
    (data: { id: string }) => {
      setTasks((prevTasks) => prevTasks.filter((t) => t.id !== data.id));
      toast.info('Tarea eliminada');
    }
  );

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

  useEffect(() => {
    loadTasks();
    checkCalendarStatus();
  }, []);

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

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header con usuario y logout */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
            {session.user?.name?.[0]?.toUpperCase() || session.user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-medium">{session.user?.name || 'Usuario'}</p>
            <p className="text-sm text-muted-foreground">{session.user?.email}</p>
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
            onClick={() => signOut({ callbackUrl: '/login' })}
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{task.title}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border ${getStatusColor(task.status)}`}>
                        {getStatusIcon(task.status)}
                        {getStatusText(task.status)}
                      </span>
                      <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {getPriorityText(task.priority)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(task)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {task.description && (
                  <CardDescription className="mb-3 line-clamp-3">{task.description}</CardDescription>
                )}
                {task.due_date && (() => {
                  const parsedDate = parseLocalDate(task.due_date);
                  if (!parsedDate) return null;
                  return (
                    <p className="text-sm text-muted-foreground">
                      Vencimiento: {format(parsedDate, 'dd MMM yyyy', { locale: es })}
                      {task.time && ` a las ${task.time}`}
                    </p>
                  );
                })()}
                {task.google_calendar_event_id && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <span>📅</span> Sincronizado con Google Calendar
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Creada: {format(new Date(task.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de crear tarea */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nueva Tarea</DialogTitle>
            <DialogDescription>Completa los campos para crear una nueva tarea</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título de la tarea"
              />
            </div>
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción de la tarea"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in_progress">En progreso</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="due_date">Fecha de vencimiento</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="time">Hora (opcional)</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                placeholder="HH:MM"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se creará un evento de 1 hora en Google Calendar si está conectado
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Crear Tarea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de editar tarea */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tarea</DialogTitle>
            <DialogDescription>Modifica los campos de la tarea</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Título *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título de la tarea"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción de la tarea"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-status">Estado</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in_progress">En progreso</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-priority">Prioridad</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-due_date">Fecha de vencimiento</Label>
              <Input
                id="edit-due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-time">Hora (opcional)</Label>
              <Input
                id="edit-time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                placeholder="HH:MM"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se actualizará el evento en Google Calendar si está conectado
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingTask(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate}>Guardar Cambios</Button>
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
