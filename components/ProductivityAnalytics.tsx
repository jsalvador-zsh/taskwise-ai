'use client';

import { useMemo } from 'react';
import { Task } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, subDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, ListTodo, TrendingUp, Clock } from 'lucide-react';

interface ProductivityAnalyticsProps {
  tasks: Task[];
}

export function ProductivityAnalytics({ tasks }: ProductivityAnalyticsProps) {
  // Datos para gráfico de completadas vs creadas por día (últimos 7 días)
  const last7DaysData = useMemo(() => {
    const today = new Date();
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const formattedDate = format(date, 'EEE', { locale: es });

      const created = tasks.filter(t =>
        t.created_at && isSameDay(new Date(t.created_at), date)
      ).length;

      const completed = tasks.filter(t =>
        t.status === 'completed' &&
        t.updated_at && isSameDay(new Date(t.updated_at), date)
      ).length;

      result.push({
        name: formattedDate,
        creadas: created,
        completadas: completed,
      });
    }
    return result;
  }, [tasks]);

  // Estadísticas globales
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, pending, efficiency };
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
      {/* Resumen Estadístico */}
      <div className="md:col-span-1 flex flex-col gap-4">
        <Card className="bg-white/50 backdrop-blur-sm border-slate-200/60 overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="h-1 w-full bg-emerald-500/20 group-hover:bg-emerald-500 transition-colors" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tareas</p>
              <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                <ListTodo className="w-4 h-4" />
              </div>
            </div>
            <h4 className="text-3xl font-extrabold text-slate-900">{stats.total}</h4>
            <p className="text-[10px] text-slate-400 mt-1">Registradas en el sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-white/50 backdrop-blur-sm border-slate-200/60 overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="h-1 w-full bg-emerald-500/20 group-hover:bg-emerald-500 transition-colors" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completadas</p>
              <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <h4 className="text-3xl font-extrabold text-slate-900">{stats.completed}</h4>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600">{stats.efficiency}% de éxito</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/50 backdrop-blur-sm border-slate-200/60 overflow-hidden group hover:shadow-lg transition-all duration-300">
          <div className="h-1 w-full bg-teal-500/20 group-hover:bg-teal-500 transition-colors" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">En Marcha</p>
              <div className="p-1.5 bg-teal-50 rounded-lg text-teal-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <h4 className="text-3xl font-extrabold text-slate-900">{stats.inProgress}</h4>
            <p className="text-[10px] text-slate-400 mt-1">Requieren tu atención hoy</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Actividad */}
      <Card className="md:col-span-3 bg-white/50 backdrop-blur-sm border-slate-200/60 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Rendimiento Semanal
          </CardTitle>
          <CardDescription className="text-xs">
            Comparativa de tareas creadas vs completadas en los últimos 7 días
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last7DaysData}>
              <defs>
                <linearGradient id="colorCreadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompletadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              />
              <Area
                name="Creadas"
                type="monotone"
                dataKey="creadas"
                stroke="#34d399"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorCreadas)"
              />
              <Area
                name="Completadas"
                type="monotone"
                dataKey="completadas"
                stroke="#059669"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorCompletadas)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
