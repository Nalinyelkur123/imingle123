const PROD_BACKEND_URL = "https://imingle-backend.onrender.com";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_API_URL;

    // 1. If an explicit API URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // 2. If running locally on localhost/127.0.0.1
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return envUrl || "http://localhost:3001";
    }

    // 3. In production, connect to the configured live backend server
    return envUrl || PROD_BACKEND_URL;
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

    // 1. If an explicit WebSocket URL is configured, use it
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }

    // 2. If running locally on localhost/127.0.0.1
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return envUrl || "http://localhost:3001";
    }

    // 3. In production, connect to the configured live backend server
    return envUrl || PROD_BACKEND_URL;
  }

  return process.env.NEXT_PUBLIC_WS_URL || PROD_BACKEND_URL;
}
