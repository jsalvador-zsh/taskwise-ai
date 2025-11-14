import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

export function useSocket(onTaskCreated?: (task: any) => void, onTaskUpdated?: (task: any) => void, onTaskDeleted?: (data: { id: string }) => void) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Conectar al servidor Socket.io
    const socket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Conectado a Socket.io');
      // Unirse a la sala del usuario
      socket.emit('join-user-room', session.user.id);
    });

    socket.on('disconnect', () => {
      console.log('Desconectado de Socket.io');
    });

    // Escuchar eventos de tareas
    if (onTaskCreated) {
      socket.on('task:created', onTaskCreated);
    }

    if (onTaskUpdated) {
      socket.on('task:updated', onTaskUpdated);
    }

    if (onTaskDeleted) {
      socket.on('task:deleted', onTaskDeleted);
    }

    return () => {
      socket.disconnect();
    };
  }, [session?.user?.id, onTaskCreated, onTaskUpdated, onTaskDeleted]);

  return socketRef.current;
}
