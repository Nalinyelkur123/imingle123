// ============================================================================
// NexusChat / V Mingle — Frontend Environment & URL Resolver
// ============================================================================

/**
 * Dynamically resolves the API base URL.
 * - In production: uses NEXT_PUBLIC_API_URL or current origin.
 * - In development when accessing from another device (e.g. mobile on LAN IP):
 *   automatically routes to the host machine's IP on port 3001 rather than localhost.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_API_URL;

    // If an explicit non-localhost production URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // If accessing from another device on the network (e.g. 192.168.x.x, 10.x.x.x, tunnel),
    // connect to port 3001 on the SAME hostname instead of resolving to client's own localhost
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:3001`;
    }

    return envUrl || "http://localhost:3001";
  }

  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

/**
 * Dynamically resolves the WebSocket URL for Socket.IO.
 */
export function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;

    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:3001`;
    }

    return envUrl || "http://localhost:3001";
  }

  return process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
}
