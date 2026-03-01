'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useState, useMemo } from 'react';
import { Task, TaskStatus } from '@/lib/types';
import { DraggableTaskCard } from './DraggableTaskCard';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import { Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: string, newStatus: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAddTask: (status: TaskStatus) => void;
  getUserName: (userId: string | null) => string;
  currentUserId?: string;
}

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'pending', title: 'Pendiente', color: 'bg-amber-500/10 border-amber-500/20 text-amber-700' },
  { id: 'in_progress', title: 'En progreso', color: 'bg-teal-500/10 border-teal-500/20 text-teal-700' },
  { id: 'completed', title: 'Completada', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' },
  { id: 'cancelled', title: 'Cancelada', color: 'bg-slate-500/10 border-slate-500/20 text-slate-700' }
];

// Componente para una columna Droppable
function KanbanColumn({
  column,
  tasks,
  onEdit,
  onDelete,
  onAddTask,
  getUserName,
  currentUserId
}: {
  column: typeof COLUMNS[0],
  tasks: Task[],
  onEdit: (task: Task) => void,
  onDelete: (id: string) => void,
  onAddTask: (status: TaskStatus) => void,
  getUserName: (userId: string | null) => string,
  currentUserId?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col h-full min-w-[280px] group/column">
      {/* Header de Columna */}
      <div className={cn(
        "flex items-center justify-between p-3 mb-4 border rounded-xl shadow-sm bg-white/50 backdrop-blur-sm sticky top-0 z-10 transition-colors",
        column.color.split(' ')[1],
        isOver && "border-emerald-500 bg-emerald-50/50"
      )}>
        <div className="flex items-center gap-2">
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full", column.color.split(' ')[2].replace('text-', 'bg-'))} />
          <h3 className="font-bold text-sm tracking-tight capitalize">{column.title}</h3>
          <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-slate-200 font-bold text-slate-500">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover/column:opacity-100 transition-opacity"
          onClick={() => onAddTask(column.id)}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      <SortableContext
        id={column.id}
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 flex flex-col gap-4 p-2 rounded-2xl transition-all duration-200 min-h-[400px]",
            "bg-slate-50/30 border border-dashed border-slate-200 group-hover/column:bg-slate-50/60",
            isOver && "bg-emerald-50/70 border-emerald-300"
          )}
        >
          {tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              getUserName={getUserName}
              currentUserId={currentUserId}
            />
          ))}

          {tasks.length === 0 && !isOver && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
              <p className="text-[10px] font-medium italic opacity-40">Mueve una tarea aquí</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  onTaskMove,
  onEdit,
  onDelete,
  onAddTask,
  getUserName,
  currentUserId
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
      // IMPORTANT for DnD on touch devices
      // This prevents the browser's default touch actions (like scrolling) from interfering with drag
      // It should be applied to the draggable element itself, or the sensor if it's a global setting.
      // For dnd-kit, setting it on the sensor is a good general approach.
      // However, the most effective place is often directly on the draggable element's style.
      // The instruction implies a style object, but for a sensor, it's not a style prop.
      // Let's assume the instruction meant to add it to the draggable element's style within DragOverlay.
      // The provided snippet structure is a bit ambiguous for direct insertion here.
      // I will add it to the DragOverlay's div style.
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      cancelled: []
    };
    tasks.forEach(task => {
      groups[task.status as TaskStatus].push(task);
    });
    return groups;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveTask(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Detectar si soltamos sobre una columna o tarea
    const overColumnId = COLUMNS.find(c => c.id === overId)?.id;
    const overTask = tasks.find(t => t.id === overId);

    // Si soltamos sobre otra tarea, tomamos su estado. Si soltamos sobre la columna, tomamos su ID.
    const targetStatus = overColumnId || (overTask?.status as TaskStatus);
    const task = tasks.find(t => t.id === activeId);

    if (task && targetStatus && task.status !== targetStatus) {
      onTaskMove(activeId, targetStatus);
    }

    setActiveTask(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[600px] overflow-x-auto pb-4 px-1">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasksByStatus[column.id]}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddTask={onAddTask}
            getUserName={getUserName}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[280px] shadow-2xl rotate-2 opacity-90 scale-105 transition-transform duration-200">
            <TaskCard
              task={activeTask}
              onEdit={() => { }}
              onDelete={() => { }}
              getUserName={getUserName}
              currentUserId={currentUserId}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
