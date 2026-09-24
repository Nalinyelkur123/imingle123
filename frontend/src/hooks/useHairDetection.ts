// ============================================================================
// V Mingle — useHairDetection Hook
// ============================================================================
// Periodically samples video frames from the local camera MediaStream at a
// configurable framerate (default 5 FPS), runs the modular hair detection
// model, and emits detection events to the backend over the authenticated
// Socket.IO connection.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { createHairDetector, IHairDetector, DetectionResult } from "@/services/detection/hairDetector";
import { connectSocket } from "@/services/socket";
import { SocketEvents, HairDetectionPayload } from "@/services/api";

interface UseHairDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sessionId?: string | null;
  userId?: string | null;
  enabled?: boolean;
  fps?: number;
}

export function useHairDetection({
  videoRef,
  sessionId,
  userId,
  enabled = true,
  fps = 5,
}: UseHairDetectionOptions) {
  const [latestDetection, setLatestDetection] = useState<DetectionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const detectorRef = useRef<IHairDetector | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    // Instantiate modular detector
    detectorRef.current = createHairDetector();

    return () => {
      if (detectorRef.current?.dispose) {
        detectorRef.current.dispose();
      }
      detectorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsProcessing(false);
      return;
    }

    const intervalMs = Math.max(100, Math.floor(1000 / fps));
    setIsProcessing(true);

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;

      // Ensure video is actively playing and no concurrent frame is being processed
      if (!video || !detector || video.readyState < 2 || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      try {
        const result = await detector.detect(video);
        setLatestDetection(result);

        // Emit detection event to backend via existing authenticated socket
        const socket = connectSocket();
        const payload: HairDetectionPayload = {
          session_id: sessionId,
          user_id: userId || undefined,
          long_hair_detected: result.long_hair_detected,
          confidence: result.confidence,
          timestamp: new Date().toISOString(),
        };

        socket.emit(SocketEvents.HAIR_DETECTION_RESULT, payload);
      } catch (err) {
        console.warn("Hair detection frame processing error (non-fatal):", err);
      } finally {
        inFlightRef.current = false;
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsProcessing(false);
    };
  }, [enabled, sessionId, userId, fps, videoRef]);

  return {
    latestDetection,
    isProcessing,
  };
}
