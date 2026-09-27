// ============================================================================
// NexusChat — Frontend REST API Client
// ============================================================================

import { ReportPayload } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  !window.location.hostname.includes("127.0.0.1")
    ? "https://imingle-backend.onrender.com"
    : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : "http://localhost:3001");

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
    const res = await fetch(`${API_BASE_URL}/api/stats`, {
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
  payload: ReportPayload & { matchId?: string; reportedUserId?: string }
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
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
    const res = await fetch(`${API_BASE_URL}/api/config/ice-servers`, {
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
    // Graceful fallback to default STUN + OpenRelay TURN servers
  }

  return fallbackServers;
}
