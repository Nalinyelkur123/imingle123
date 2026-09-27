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
 * Dynamically resolves the API base URL.
 * - In production: uses NEXT_PUBLIC_API_URL or defaults to live production backend.
 * - In local development (localhost): uses http://localhost:3001.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_API_URL;

    // 1. If an explicit production URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // 2. If running locally on localhost/127.0.0.1
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return envUrl || "http://localhost:3001";
    }

    // 3. For all other environments, connect directly to the production backend
    return envUrl || PROD_BACKEND_FALLBACK;
  }

  return process.env.NEXT_PUBLIC_API_URL || PROD_BACKEND_FALLBACK;
}

/**
 * Dynamically resolves the WebSocket URL for Socket.IO.
 */
export function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;

    // 1. If an explicit production WebSocket URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // 2. If running locally on localhost/127.0.0.1
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return envUrl || "http://localhost:3001";
    }

    // 3. For all other environments, connect directly to the production backend
    return envUrl || PROD_BACKEND_FALLBACK;
  }

  return process.env.NEXT_PUBLIC_WS_URL || PROD_BACKEND_FALLBACK;
}



