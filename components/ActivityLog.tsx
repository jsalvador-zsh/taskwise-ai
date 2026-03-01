'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  History,
  User,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  PencilLine,
  UserPlus
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface Activity {
  id: string;
  task_id: string;
  user_id: string;
  activity_type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user?: {
    email: string;
    full_name: string | null;
  };
}

interface ActivityLogProps {
  taskId: string;
}

export function ActivityLog({ taskId }: ActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/activities`);
        const result = await response.json();
        if (result.success) {
          setActivities(result.data);
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [taskId]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'status_changed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'priority_changed':
        return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      case 'assigned':
        return <UserPlus className="w-3.5 h-3.5 text-teal-500" />;
      case 'created':
        return <Clock className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <PencilLine className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    const userName = activity.user?.full_name || activity.user?.email || 'Un usuario';

    switch (activity.activity_type) {
      case 'created':
        return <span><strong>{userName}</strong> creó la tarea</span>;
      case 'status_changed':
        return (
          <span className="flex items-center flex-wrap gap-1">
            <strong>{userName}</strong> cambió el estado de
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 font-bold text-[10px]">{activity.old_value}</span>
            <ArrowRight className="w-2.5 h-2.5 mx-0.5 opacity-40" />
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">{activity.new_value}</span>
          </span>
        );
      case 'priority_changed':
        return (
          <span className="flex items-center flex-wrap gap-1">
            <strong>{userName}</strong> cambió la prioridad a <strong>{activity.new_value}</strong>
          </span>
        );
      case 'assigned':
        return <span><strong>{userName}</strong> asignó la tarea</span>;
      default:
        return <span><strong>{userName}</strong> actualizó la tarea</span>;
    }
  };

  if (loading) return <div className="p-4 text-center text-xs text-slate-400">Cargando historial...</div>;
  if (activities.length === 0) return <div className="p-10 text-center text-xs text-slate-400 italic">No hay actividad registrada para esta tarea.</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-200/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200/80 bg-white/50 backdrop-blur-sm flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 tracking-tight uppercase">
          <History className="w-4 h-4 text-emerald-600" />
          Historial de Actividad
        </h3>
        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
          {activities.length} eventos
        </span>
      </div>

      <ScrollArea className="flex-1 p-4 h-[400px]">
        <div className="space-y-6 relative ml-2 px-4 pb-4">
          {/* Línea vertical decorativa */}
          <div className="absolute left-0 top-1 bottom-1 w-[1px] bg-slate-200" />

          {activities.map((activity, idx) => (
            <div key={activity.id} className="relative group">
              {/* Punto en la línea de tiempo */}
              <div className={cn(
                "absolute -left-[20px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 transition-transform group-hover:scale-125",
                idx === 0 ? "bg-emerald-500 ring-4 ring-emerald-50" : "bg-slate-300"
              )} />

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] leading-relaxed text-slate-600">
                  <div className="p-1 bg-white border border-slate-100 rounded-md shadow-sm">
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  {getActivityText(activity)}
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-7">
                  {format(new Date(activity.created_at), "d 'de' MMMM, HH:mm", { locale: es })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
