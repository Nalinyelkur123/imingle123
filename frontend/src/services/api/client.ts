// ============================================================================
// NexusChat — Frontend REST API Client
// ============================================================================

import { ReportPayload } from "./types";
import { getApiBaseUrl } from "./config";

export interface StatsResponse {
  status: string;
  timestamp: string;
  stats: {
    onlineUsers: number;
    activeMatches: number;
    waitingQueue: {
      text: number;
      video: number;
    };
  };
}

export async function fetchLiveStats(): Promise<StatsResponse | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/stats`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as StatsResponse;
  } catch {
    return null;
  }
}

export async function submitReportApi(
  payload: ReportPayload & { matchId?: string; reportedUserId?: string; token?: string; reporterSessionId?: string }
): Promise<boolean> {
  try {
    const token = payload.token || (typeof window !== "undefined" ? sessionStorage.getItem("umingle_anonymous_session_token") : null);
    const res = await fetch(`${getApiBaseUrl()}/api/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  const fallbackServers: RTCIceServer[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun.cloudflare.com:3478",
      ],
    },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelay",
      credential: "openrelay",
    },
  ];

  if (process.env.NEXT_PUBLIC_TURN_URL) {
    fallbackServers.push({
      urls: process.env.NEXT_PUBLIC_TURN_URL.split(",").map((s) => s.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/config/ice-servers`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        return data.iceServers;
      }
    }
  } catch {
  }

  return fallbackServers;
}
