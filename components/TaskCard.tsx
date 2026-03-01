'use client';

import { Task, TaskStatus, TaskPriority } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  User,
  Edit,
  Trash2,
  CheckCircle2,
  Clock3,
  AlertCircle,
  MoreVertical,
  CalendarCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  getUserName: (userId: string | null) => string;
  currentUserId?: string;
}

// Función helper para parsear fechas tipo 'date' sin conversión UTC
function parseLocalDate(dateString: string | null): Date | null {
  if (!dateString) return null;
  try {
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (error) {
    return null;
  }
}

export function TaskCard({ task, onEdit, onDelete, getUserName, currentUserId }: TaskCardProps) {
  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return {
          label: 'Completada',
          color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          dot: 'bg-emerald-500'
        };
      case 'in_progress':
        return {
          label: 'En progreso',
          color: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
          icon: <Clock3 className="w-3.5 h-3.5" />,
          dot: 'bg-teal-500'
        };
      case 'cancelled':
        return {
          label: 'Cancelada',
          color: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          dot: 'bg-slate-500'
        };
      default:
        return {
          label: 'Pendiente',
          color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
          icon: <Clock className="w-3.5 h-3.5" />,
          dot: 'bg-amber-500'
        };
    }
  };

  const getPriorityConfig = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return { label: 'Urgente', color: 'text-rose-600 bg-rose-50', border: 'border-rose-200' };
      case 'high':
        return { label: 'Alta', color: 'text-orange-600 bg-orange-50', border: 'border-orange-200' };
      case 'low':
        return { label: 'Baja', color: 'text-slate-500 bg-slate-50', border: 'border-slate-200' };
      default:
        return { label: 'Media', color: 'text-emerald-600 bg-emerald-50', border: 'border-emerald-200' };
    }
  };

  const status = getStatusConfig(task.status);
  const priority = getPriorityConfig(task.priority);
  const dueDate = parseLocalDate(task.due_date);

  return (
    <Card className="group relative overflow-hidden h-full hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 border-slate-200/60 bg-white/70 backdrop-blur-sm">
      {/* Indicador de prioridad superior */}
      <div className={cn("h-1 w-full absolute top-0 left-0", priority.color.split(' ')[1].replace('bg-', 'bg-'))} />

      <CardContent className="p-5 flex flex-col h-full">
        {/* Header de la tarjeta */}
        <div className="flex justify-between items-start mb-3">
          <Badge
            variant="outline"
            className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", status.color)}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full", status.dot)} />
              {status.label}
            </div>
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onEdit(task)} className="gap-2 text-slate-600">
                <Edit className="h-4 w-4" /> Editar
              </DropdownMenuItem>
              {task.user_id === currentUserId && (
                <DropdownMenuItem onClick={() => onDelete(task.id)} className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                  <Trash2 className="h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Título y Descripción */}
        <div className="flex-1 space-y-2 mb-4">
          <h3 className="font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-emerald-600 transition-colors">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic">
              {task.description}
            </p>
          )}
        </div>

        {/* Meta información */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {dueDate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                {format(dueDate, 'dd MMM', { locale: es })}
              </div>
            )}

            {task.time && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                {task.time}
              </div>
            )}

            <div className={cn("px-2 py-0.5 rounded text-[10px] font-semibold border", priority.color, priority.border)}>
              {priority.label}
            </div>
          </div>

          <div className="flex items-center justify-between mt-auto">
            {/* Asignado a */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                <User className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-[11px] font-medium text-slate-600 max-w-[100px] truncate">
                {task.assigned_to ? getUserName(task.assigned_to) : 'Sin asignar'}
              </span>
            </div>

            {/* Google Calendar Sync status */}
            {task.google_calendar_event_id && (
              <div className="flex items-center">
                <div className="group/tooltip relative">
                  <CalendarCheck className="w-4 h-4 text-emerald-500" />
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                    Sincronizado con Calendar
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
