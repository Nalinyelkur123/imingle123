// ============================================================================
// NexusChat — API & WebSocket Dynamic Configuration
// ============================================================================

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const envUrl = process.env.NEXT_PUBLIC_API_URL;

    // 1. If an explicit API URL is configured, use it
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

    // 4. In production, default fallback to configured URL or origin
    return (
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3001")
    );
  }

  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
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

    // 4. In production, default fallback to configured URL or origin
    return (
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3001")
    );
  }

  return process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
}
