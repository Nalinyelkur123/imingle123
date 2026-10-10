// ============================================================================
// NexusChat — API & WebSocket Dynamic Configuration
// ============================================================================

const PROD_BACKEND_URL = "https://imingle-backend.onrender.com";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_API_URL;

    // 1. If an explicit remote API URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // 2. Check if hostname is a LAN IP or mDNS hostname (.local) for local mobile testing
    const isLanIp =
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith(".local");
    if (isLanIp) {
      return `http://${hostname}:3001`;
    }

    // 3. If running locally on localhost/127.0.0.1
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return envUrl || "http://localhost:3001";
    }

    // 4. In production (e.g. vmingle.in or deployed sites):
    // The static frontend is hosted separately from the backend Express/Socket.IO server.
    return PROD_BACKEND_URL;
  }

  return process.env.NEXT_PUBLIC_API_URL || PROD_BACKEND_URL;
}

/**
 * Dynamically resolves the WebSocket URL for Socket.IO.
 */
export function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;

    // 1. If an explicit remote WebSocket URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // 2. Check if hostname is a LAN IP or mDNS hostname (.local)
    const isLanIp =
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith(".local");
    if (isLanIp) {
      return `http://${hostname}:3001`;
    }

    // 3. If running locally on localhost/127.0.0.1
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return envUrl || "http://localhost:3001";
    }

    // 4. In production (e.g. vmingle.in):
    return PROD_BACKEND_URL;
  }

  return process.env.NEXT_PUBLIC_WS_URL || PROD_BACKEND_URL;
}
