// ============================================================================
// NexusChat — Frontend Anonymous Session Service (Privacy-Safe)
// ============================================================================
// Zero biometrics, zero face tracking, zero personal profiling.
// Session identity is ephemeral, cryptographically verified, and isolated
// to the active browser tab via sessionStorage and HttpOnly session cookies.
// ============================================================================

const SESSION_STORAGE_KEY = "umingle_anonymous_session_token";
const SESSION_ID_KEY = "umingle_anonymous_session_id";

import { getApiBaseUrl } from "./api/config";

export interface AnonymousSession {
  sessionId: string;
  userId?: string;
  sessionToken: string;
  status: "idle" | "queued" | "matched" | "reconnecting" | "expired";
  expiresAt: number;
}

export function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // Graceful fallback
  }
}

/**
 * Initializes or continues an existing privacy-safe anonymous session.
 * Validates with the backend using HMAC token header.
 */
export async function initAnonymousSession(
  mode: "video" | "text" = "video"
): Promise<AnonymousSession | null> {
  const existingToken = getStoredSessionToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (existingToken) {
    headers["Authorization"] = `Bearer ${existingToken}`;
  }

  try {
    let interests: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("umingle_interests");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) interests = parsed;
        }
      } catch {}
    }

    const res = await fetch(`${getApiBaseUrl()}/api/session/init`, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode, interests }),
    });

    if (!res.ok) {
      // If token expired/invalid, clear local token and re-init fresh
      if (res.status === 401 || res.status === 404) {
        clearStoredSession();
        return initAnonymousSession(mode);
      }
      throw new Error(`Session initialization failed with status ${res.status}`);
    }

    const payload = await res.json();
    const data = payload.data || payload.session;
    if (data) {
      const sessionData: AnonymousSession = {
        sessionId: data.sessionId,
        userId: data.userId || `usr_${data.sessionId.replace(/^sess_/, '')}`,
        sessionToken: data.sessionToken || data.token,
        status: data.status,
        expiresAt: data.expiresAt,
      };

      if (typeof window !== "undefined") {
        try {
          // Strictly isolate session identity to this browser tab via sessionStorage
          sessionStorage.setItem(SESSION_STORAGE_KEY, sessionData.sessionToken);
          sessionStorage.setItem(SESSION_ID_KEY, sessionData.sessionId);
          // Clean up any legacy shared localStorage keys to prevent cross-tab conflation
          localStorage.removeItem(SESSION_STORAGE_KEY);
          localStorage.removeItem(SESSION_ID_KEY);
        } catch {
          // storage may fail in private mode if restricted
        }
      }

      return sessionData;
    }

    return null;
  } catch (err) {
    console.warn("Failed to reach backend for session initialization:", err);
    // Return null so the app can handle degraded mode or retry
    return null;
  }
}

/**
 * Explicitly terminates the current session on the backend.
 */
export async function endAnonymousSession(reason = "user_ended"): Promise<boolean> {
  const token = getStoredSessionToken();
  if (!token) return true;

  try {
    await fetch(`${getApiBaseUrl()}/api/session/end`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
  } catch {
    // Best effort on teardown
  } finally {
    clearStoredSession();
  }
  return true;
}
