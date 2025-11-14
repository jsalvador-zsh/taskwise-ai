// Helper para emitir eventos de Socket.io desde API routes
export function emitTaskEvent(userId: string, event: string, data: any) {
  try {
    const io = (global as any).io;
    if (io) {
      io.to(`user:${userId}`).emit(event, data);
      console.log(`Evento ${event} emitido a usuario ${userId}`);
    } else {
      console.warn('Socket.io no está disponible');
    }
  } catch (error) {
    console.error('Error al emitir evento de Socket.io:', error);
  }
}
