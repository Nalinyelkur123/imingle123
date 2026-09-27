// ============================================================================
// NexusChat / V Mingle — Frontend Environment & URL Resolver
// ============================================================================

/**
 * Dynamically resolves the API base URL.
 * - In production: uses NEXT_PUBLIC_API_URL or current origin.
 * - In development when accessing from another device (e.g. mobile on LAN IP):
 *   automatically routes to the host machine's IP on port 3001 rather than localhost.
 */
const PROD_BACKEND_FALLBACK = "https://imingle-backend.onrender.com";

/**
 * Checks if a hostname is a local loopback or private LAN IP address.
 */
function isLocalNetwork(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/**
 * Dynamically resolves the API base URL.
 * - In production: uses NEXT_PUBLIC_API_URL or defaults to Render backend URL.
 * - In local dev / LAN: routes to host machine's port 3001.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_API_URL;

    // 1. If an explicit production URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // 2. If testing on local LAN from mobile/another device, connect to port 3001
    if (isLocalNetwork(hostname)) {
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `${protocol}//${hostname}:3001`;
      }
      return envUrl || "http://localhost:3001";
    }

    // 3. In production with a public domain, use the live Render backend
    return envUrl || PROD_BACKEND_FALLBACK;
  }

  return process.env.NEXT_PUBLIC_API_URL || PROD_BACKEND_FALLBACK;
}

/**
 * Dynamically resolves the WebSocket URL for Socket.IO.
 */
export function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;

    // 1. If an explicit production WebSocket URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // 2. If testing on local LAN from mobile/another device, connect to port 3001
    if (isLocalNetwork(hostname)) {
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `${protocol}//${hostname}:3001`;
      }
      return envUrl || "http://localhost:3001";
    }

    // 3. In production with a public domain, use the live Render backend
    return envUrl || PROD_BACKEND_FALLBACK;
  }

  return process.env.NEXT_PUBLIC_WS_URL || PROD_BACKEND_FALLBACK;
}


