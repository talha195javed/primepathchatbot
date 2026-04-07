import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
// Socket connects to the server root, not /api
const SOCKET_URL = API_BASE_URL.replace('/api', '');

let socket: Socket | null = null;

export interface SocketMessage {
  id: string;
  threadId: string;
  content: string;
  role: 'customer' | 'team';
  status: string;
  createdAt: string;
}

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  }
  return socket;
};

export const joinThread = (threadId: string) => {
  const s = getSocket();
  s.emit('join-thread', threadId);
};

export const onNewMessage = (callback: (msg: SocketMessage) => void) => {
  const s = getSocket();
  s.on('new-message', callback);
  return () => {
    s.off('new-message', callback);
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
