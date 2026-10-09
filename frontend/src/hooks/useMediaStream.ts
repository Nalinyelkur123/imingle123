// ============================================================================
// V Mingle — useMediaStream Hook
// ============================================================================
// Centralized, production-grade media permission and hardware stream lifecycle
// manager. Supports:
// - User-gesture gated permissions
// - Returning visitor permission caching & re-use
// - Actionable error classification (NotAllowed, NotFound, NotReadable, etc.)
// - Audio-only and video-only fallbacks when one hardware component is missing
// - Hardware disconnection handling via track.onended
// - Front/back camera switching on mobile with seamless RTCPeerConnection track replacement
// - Leak-proof unmount cancellation to ensure hardware LEDs turn off immediately
// ============================================================================

import { useState, useRef, useCallback, useEffect } from "react";

export type MediaStatus =
  | "idle"
  | "prompt"
  | "requesting"
  | "ready"
  | "denied"
  | "not_found"
  | "not_readable"
  | "overconstrained"
  | "security_error"
  | "insecure_context"
  | "unsupported"
  | "device_error";

export interface MediaDeviceInfoSummary {
  hasMultipleCameras: boolean;
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
}

export interface UseMediaStreamResult {
  status: MediaStatus;
  stream: MediaStream | null;
  errorMessage: string;
  hasVideo: boolean;
  hasAudio: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  facingMode: "user" | "environment";
  audioOnly: boolean;
  videoOnly: boolean;
  deviceInfo: MediaDeviceInfoSummary;
  acquireMedia: (options?: {
    userInitiated?: boolean;
    facingMode?: "user" | "environment";
    allowFallback?: boolean;
  }) => Promise<MediaStream | null>;
  toggleAudio: (forceState?: boolean) => boolean;
  toggleVideo: (forceState?: boolean) => boolean;
  switchCamera: (
    onTrackReplaced?: (newTrack: MediaStreamTrack) => Promise<void> | void
  ) => Promise<boolean>;
  releaseMedia: () => void;
  checkPermissionState: () => Promise<"granted" | "prompt" | "denied" | "unknown">;
}

export function useMediaStream(mode: "video" | "text" = "video"): UseMediaStreamResult {
  const [status, setStatus] = useState<MediaStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [audioOnly, setAudioOnly] = useState(false);
  const [videoOnly, setVideoOnly] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<MediaDeviceInfoSummary>({
    hasMultipleCameras: false,
    videoInputs: [],
    audioInputs: [],
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inFlightPromiseRef = useRef<Promise<MediaStream | null>>(null);
  const isMountedRef = useRef(true);

  // Check hardware devices list
  const refreshDevices = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      if (isMountedRef.current) {
        setDeviceInfo({
          hasMultipleCameras: videoInputs.length > 1,
          videoInputs,
          audioInputs,
        });
      }
    } catch {
      // Ignore enumeration failure
    }
  }, []);

  // Check permission state via Permissions API where supported
  const checkPermissionState = useCallback(async (): Promise<"granted" | "prompt" | "denied" | "unknown"> => {
    if (typeof window === "undefined" || !navigator.permissions?.query) {
      return "unknown";
    }
    try {
      // Some browsers (e.g. Firefox) throw TypeError when querying 'camera'
      const camPerm = await navigator.permissions.query({ name: "camera" as PermissionName });
      let micPerm: PermissionStatus | null = null;
      try {
        micPerm = await navigator.permissions.query({ name: "microphone" as PermissionName });
      } catch {}

      if (camPerm.state === "denied" || micPerm?.state === "denied") {
        return "denied";
      }
      if (camPerm.state === "granted" && (!micPerm || micPerm.state === "granted")) {
        return "granted";
      }
      return "prompt";
    } catch {
      return "unknown";
    }
  }, []);

  // Stop all active tracks on the managed stream
  const releaseMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.onended = null;
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setStream(null);
    if (isMountedRef.current) {
      setHasVideo(false);
      setHasAudio(false);
      setAudioOnly(false);
      setVideoOnly(false);
    }
  }, []);

  // Attach onended event handlers to handle device disconnection gracefully
  const bindTrackEvents = useCallback((stream: MediaStream) => {
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        console.warn("[MEDIA] Video track ended unexpectedly (device disconnected)");
        if (isMountedRef.current) {
          setHasVideo(false);
          setStatus("device_error");
          setErrorMessage("Camera was disconnected or interrupted. Please reconnect and click Retry.");
        }
      };
    });

    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        console.warn("[MEDIA] Audio track ended unexpectedly (device disconnected)");
        if (isMountedRef.current) {
          setHasAudio(false);
        }
      };
    });
  }, []);

  // Acquire media stream with robust fallback cascade and error classification
  const acquireMedia = useCallback(
    async (options?: {
      userInitiated?: boolean;
      facingMode?: "user" | "environment";
      allowFallback?: boolean;
    }): Promise<MediaStream | null> => {
      if (mode !== "video") {
        return null;
      }

      if (typeof window === "undefined") {
        return null;
      }

      const targetFacing = options?.facingMode || facingMode;
      const allowFallback = options?.allowFallback !== false;

      // 1. Re-use existing live stream if still healthy
      if (
        streamRef.current &&
        streamRef.current.active &&
        streamRef.current.getTracks().some((t) => t.readyState === "live")
      ) {
        const stream = streamRef.current;
        setStatus("ready");
        setErrorMessage("");
        setHasVideo(stream.getVideoTracks().some((t) => t.readyState === "live"));
        setHasAudio(stream.getAudioTracks().some((t) => t.readyState === "live"));
        setStream(stream);
        return stream;
      }

      // 2. Return existing in-flight request to avoid race condition/duplicate calls
      if (inFlightPromiseRef.current) {
        return inFlightPromiseRef.current;
      }

      // 3. Security context validation
      if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        setStatus("insecure_context");
        setErrorMessage(
          "Camera and microphone access requires a secure HTTPS connection. Please access this website over HTTPS or using a secure tunnel."
        );
        return null;
      }

      // 4. API capability validation
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        setErrorMessage(
          "Your browser does not support media device capture. Please update your browser or switch to Chrome, Safari, Firefox, or Edge."
        );
        return null;
      }

      setStatus("requesting");
      setErrorMessage("");

      const acquisitionPromise = (async (): Promise<MediaStream | null> => {
        let stream: MediaStream | null = null;
        let isAudioOnlyFallback = false;
        let isVideoOnlyFallback = false;

        // Cascade 1: High quality video + audio
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              facingMode: { ideal: targetFacing },
              frameRate: { ideal: 30, max: 30 },
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (err1: unknown) {
          const errName1 = err1 instanceof Error ? err1.name : "";

          // If user explicitly denied, do NOT retry automatically with reduced constraints
          if (errName1 === "NotAllowedError" || errName1 === "PermissionDeniedError") {
            throw err1;
          }

          // Cascade 2: Relaxed video + audio constraints (in case resolution was overconstrained)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: targetFacing },
              audio: true,
            });
          } catch (err2: unknown) {
            const errName2 = err2 instanceof Error ? err2.name : "";
            if (errName2 === "NotAllowedError" || errName2 === "PermissionDeniedError") {
              throw err2;
            }

            // Cascade 3: Basic video + audio
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
              });
            } catch (err3: unknown) {
              const errName3 = err3 instanceof Error ? err3.name : "";
              if (errName3 === "NotAllowedError" || errName3 === "PermissionDeniedError") {
                throw err3;
              }

              if (!allowFallback) {
                throw err3;
              }

              // Cascade 4: If video hardware missing, try audio-only fallback
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: false,
                  audio: true,
                });
                isAudioOnlyFallback = true;
              } catch {
                // Cascade 5: If microphone missing, try video-only fallback
                try {
                  stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                  });
                  isVideoOnlyFallback = true;
                } catch {
                  // Both failed: throw the original specific error
                  throw err3;
                }
              }
            }
          }
        }

        // Check if unmounted while prompt was pending
        if (!isMountedRef.current) {
          if (stream) {
            stream.getTracks().forEach((t) => t.stop());
          }
          return null;
        }

        if (stream) {
          streamRef.current = stream;
          setStream(stream);
          bindTrackEvents(stream);

          const hasVid = stream.getVideoTracks().length > 0;
          const hasAud = stream.getAudioTracks().length > 0;

          setHasVideo(hasVid);
          setHasAudio(hasAud);
          setAudioOnly(isAudioOnlyFallback);
          setVideoOnly(isVideoOnlyFallback);
          setIsVideoMuted(false);
          setIsAudioMuted(false);
          setFacingMode(targetFacing);
          setStatus("ready");
          setErrorMessage("");

          refreshDevices();
          return stream;
        }

        return null;
      })()
        .catch((err: unknown) => {
          if (!isMountedRef.current) return null;

          const errorName = err instanceof Error ? err.name : "";
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.warn(`[MEDIA] getUserMedia failed with [${errorName}]: ${errorMsg}`);

          if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
            setStatus("denied");
            setErrorMessage(
              "Camera and microphone access was denied. Please click the lock or camera icon in your browser address bar to allow permissions, then click Retry."
            );
          } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
            setStatus("not_found");
            setErrorMessage(
              "No camera or microphone found on this device. Please connect a webcam or headset and try again."
            );
          } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
            setStatus("not_readable");
            setErrorMessage(
              "Camera or microphone is already in use by another application (e.g. Zoom, FaceTime, Teams). Please close other apps and retry."
            );
          } else if (errorName === "OverconstrainedError") {
            setStatus("overconstrained");
            setErrorMessage(
              "Your camera does not support the requested video resolution. Please retry with standard settings."
            );
          } else if (errorName === "SecurityError") {
            setStatus("security_error");
            setErrorMessage(
              "Media access is restricted by your browser security or permission policy settings."
            );
          } else if (errorName === "AbortError") {
            setStatus("device_error");
            setErrorMessage(
              "Media device access was interrupted. Please click Retry to restart the camera."
            );
          } else {
            setStatus("device_error");
            setErrorMessage(
              "Camera and microphone access is required for video calling. Please allow access in browser settings and retry."
            );
          }

          return null;
        })
        .finally(() => {
          inFlightPromiseRef.current = null;
        });

      inFlightPromiseRef.current = acquisitionPromise;
      return acquisitionPromise;
    },
    [mode, facingMode, bindTrackEvents, refreshDevices]
  );

  // Toggle local microphone mute
  const toggleAudio = useCallback((forceState?: boolean): boolean => {
    if (!streamRef.current) return false;
    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return false;

    const currentMuted = isAudioMuted;
    const nextMuted = forceState !== undefined ? forceState : !currentMuted;

    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsAudioMuted(nextMuted);
    return nextMuted;
  }, [isAudioMuted]);

  // Toggle local video camera (Camera On / Off)
  const toggleVideo = useCallback((forceState?: boolean): boolean => {
    if (!streamRef.current) return false;
    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return false;

    const currentMuted = isVideoMuted;
    const nextMuted = forceState !== undefined ? forceState : !currentMuted;

    videoTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsVideoMuted(nextMuted);
    return nextMuted;
  }, [isVideoMuted]);

  // Switch camera (front / back) on mobile and replace track on active RTCPeerConnection
  const switchCamera = useCallback(
    async (
      onTrackReplaced?: (newTrack: MediaStreamTrack) => Promise<void> | void
    ): Promise<boolean> => {
      if (mode !== "video" || !streamRef.current) return false;

      const nextFacing: "user" | "environment" =
        facingMode === "user" ? "environment" : "user";

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }).catch(async () => {
          // Fallback without 'exact' if exact match fails
          return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: nextFacing },
            audio: false,
          });
        });

        const newVideoTrack = newStream.getVideoTracks()[0];
        if (!newVideoTrack) return false;

        const currentStream = streamRef.current;
        const oldVideoTrack = currentStream.getVideoTracks()[0];

        // Replace track in active MediaStream
        if (oldVideoTrack) {
          currentStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        currentStream.addTrack(newVideoTrack);

        // Notify WebRTC peer connection to replace sender track
        if (onTrackReplaced) {
          await onTrackReplaced(newVideoTrack);
        }

        bindTrackEvents(currentStream);
        setFacingMode(nextFacing);
        setStream(currentStream);
        return true;
      } catch (err) {
        console.warn("[MEDIA] Could not switch camera facingMode:", err);
        return false;
      }
    },
    [mode, facingMode, bindTrackEvents]
  );

  // Initial setup: discover devices and determine whether permissions are already granted
  useEffect(() => {
    isMountedRef.current = true;
    let isSubscribed = true;

    if (mode === "video") {
      const initMediaDiscovery = async () => {
        if (typeof window !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            if (!isSubscribed) return;
            const videoInputs = devices.filter((d) => d.kind === "videoinput");
            const audioInputs = devices.filter((d) => d.kind === "audioinput");
            setDeviceInfo({
              hasMultipleCameras: videoInputs.length > 1,
              videoInputs,
              audioInputs,
            });
          } catch {
            // Ignore enumeration failure
          }
        }

        const perm = await checkPermissionState();
        if (!isSubscribed) return;
        if (perm === "prompt") {
          setStatus((prev) => (prev === "idle" ? "prompt" : prev));
        } else if (perm === "denied") {
          setStatus("denied");
          setErrorMessage(
            "Camera and microphone access was previously denied. Please enable access in your browser settings and click Retry."
          );
        }
      };

      initMediaDiscovery();
    }

    return () => {
      isSubscribed = false;
      isMountedRef.current = false;
      releaseMedia();
    };
  }, [mode, checkPermissionState, releaseMedia]);

  return {
    status,
    stream,
    errorMessage,
    hasVideo,
    hasAudio,
    isAudioMuted,
    isVideoMuted,
    facingMode,
    audioOnly,
    videoOnly,
    deviceInfo,
    acquireMedia,
    toggleAudio,
    toggleVideo,
    switchCamera,
    releaseMedia,
    checkPermissionState,
  };
}
