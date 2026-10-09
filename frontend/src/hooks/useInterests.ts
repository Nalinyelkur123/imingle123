import { useSyncExternalStore } from "react";

let interestsListeners: Array<() => void> = [];

function subscribeInterests(callback: () => void) {
  interestsListeners.push(callback);
  window.addEventListener("storage", callback);
  return () => {
    interestsListeners = interestsListeners.filter((cb) => cb !== callback);
    window.removeEventListener("storage", callback);
  };
}

const DEFAULT_INTERESTS: string[] = [];

let cachedInterestsRaw: string | null = null;
let cachedInterests: string[] = DEFAULT_INTERESTS;

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30);
}

export function parseAndNormalizeInterests(input: string | string[]): string[] {
  const rawList = Array.isArray(input) ? input : input.split(/[,\s;]+/);
  const normalized = rawList
    .map(normalizeTag)
    .filter((t) => t.length > 0);
  return Array.from(new Set(normalized)).slice(0, 10);
}

function getInterestsSnapshot(): string[] {
  if (typeof window === "undefined") return DEFAULT_INTERESTS;
  const raw = localStorage.getItem("umingle_interests");
  if (raw === null) return DEFAULT_INTERESTS;
  if (raw !== cachedInterestsRaw) {
    cachedInterestsRaw = raw;
    try {
      const parsed = JSON.parse(raw);
      cachedInterests = parseAndNormalizeInterests(parsed);
    } catch {
      cachedInterests = DEFAULT_INTERESTS;
    }
  }
  return cachedInterests;
}

function getInterestsServerSnapshot(): string[] {
  return DEFAULT_INTERESTS;
}

export function saveInterests(newInterests: string[]) {
  const sanitized = parseAndNormalizeInterests(newInterests);
  try {
    localStorage.setItem("umingle_interests", JSON.stringify(sanitized));
  } catch {
    // ignore
  }
  interestsListeners.forEach((cb) => cb());
}

export function useInterests(): [string[], (newInterests: string[]) => void] {
  const interests = useSyncExternalStore(
    subscribeInterests,
    getInterestsSnapshot,
    getInterestsServerSnapshot
  );

  return [interests, saveInterests];
}
