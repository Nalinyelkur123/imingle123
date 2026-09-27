// ============================================================================
// NexusChat — Frontend Real-Time Socket Service
// ============================================================================

import { io, Socket } from "socket.io-client";
import { getStoredSessionToken } from "./session";
import { getWsUrl } from "./api/config";

let socketInstance: Socket | null = null;

export function getSocket(explicitToken?: string): Socket {
  const token = explicitToken || getStoredSessionToken();

  if (!socketInstance) {
    const wsUrl = getWsUrl();
    socketInstance = io(wsUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
      auth: (cb) => {
        const currentToken = explicitToken || getStoredSessionToken();
        cb({ sessionToken: currentToken || undefined });
      },
    });
  } else if (token) {
    socketInstance.auth = { sessionToken: token };
  }
  return socketInstance;
}

export function connectSocket(token?: string): Socket {
  const currentToken = token || getStoredSessionToken();
  const socket = getSocket(currentToken || undefined);

  if (currentToken) {
    socket.auth = { sessionToken: currentToken };
  }

  if (!socket.connected) {
    socket.connect();
  } else if (currentToken) {
    // If already connected, notify backend to update session identity
    socket.emit("authenticate", { sessionToken: currentToken });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socketInstance && socketInstance.connected) {
    socketInstance.disconnect();
  }
}

