"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Header } from "@/components/Header";
import { useInterests, parseAndNormalizeInterests } from "@/hooks/useInterests";
import { useHairDetection } from "@/hooks/useHairDetection";
import { useMediaStream } from "@/hooks/useMediaStream";
import {
  ChatState,
  ReportReason,
  SocketEvents,
  MatchInfo,
  MessageReceivedPayload,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  ICECandidatePayload,
  MatchEndedPayload,
  fetchIceServers,
} from "@/services/api";
import { connectSocket } from "@/services/socket";
import {
  initAnonymousSession,
  AnonymousSession,
} from "@/services/session";

interface Message {
  id: string;
  sender: "you" | "stranger" | "system";
  text: string;
  time: string;
}

interface ChatRoomProps {
  initialMode?: "video" | "text";
  autoStart?: boolean;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
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

const SUGGESTED_MODAL_TAGS = [
  "gaming",
  "music",
  "coding",
  "anime",
  "movies",
  "travel",
  "sports",
  "tech",
  "art",
  "fitness",
];

let msgCounter = 0;
function createUniqueId(prefix = "msg"): string {
  msgCounter += 1;
  return `${prefix}-${Date.now()}-${msgCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}

export function ChatRoom({ initialMode = "video", autoStart = true }: ChatRoomProps) {
  const [mode] = useState<"video" | "text">(initialMode);
  const [chatState, setChatState] = useState<ChatState>(() => {
    // Only auto-start immediately into SEARCHING if in text mode.
    // In video mode, we wait for verified camera/microphone permission before entering queue.
    if (autoStart && initialMode === "text") {
      return ChatState.SEARCHING;
    }
    return ChatState.IDLE;
  });
  const [stopConfirm, setStopConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (autoStart && initialMode === "text") {
      return [
        {
          id: createUniqueId("sys"),
          sender: "system",
          text: "Looking for someone to chat with worldwide...",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ];
    }
    return [];
  });
  const [inputMessage, setInputMessage] = useState("");
  const [sharedInterest, setSharedInterest] = useState<string | null>(null);
  const [currentMatch, setCurrentMatch] = useState<MatchInfo | null>(null);
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);
  const [remoteAutoplayBlocked, setRemoteAutoplayBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<ReportReason>(
    ReportReason.OTHER
  );
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // Anonymous session continuity & reconnection states
  const [session, setSession] = useState<AnonymousSession | null>(null);
  const [peerReconnecting, setPeerReconnecting] = useState(false);

  // Centralized media device & stream management via useMediaStream hook
  const {
    status: mediaStatus,
    stream: localStream,
    errorMessage: mediaErrorMessage,
    isAudioMuted,
    isVideoMuted,
    audioOnly,
    videoOnly,
    deviceInfo,
    acquireMedia,
    toggleAudio,
    toggleVideo,
    switchCamera,
    releaseMedia,
    checkPermissionState,
  } = useMediaStream(mode);

  const [isMirrored, setIsMirrored] = useState(true);

  // Mobile layout switch (PiP vs Split view on small screens)
  const [mobileViewMode, setMobileViewMode] = useState<"pip" | "split">("pip");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dynamic mobile viewport and keyboard detection
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewport = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      setViewportHeight(height);

      // On mobile devices, virtual keyboard reduces visualViewport height substantially
      if (vv && window.innerHeight - vv.height > 120) {
        setIsKeyboardOpen(true);
      } else {
        setIsKeyboardOpen(false);
      }
    };

    updateViewport();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewport);
      window.visualViewport.addEventListener("scroll", updateViewport);
    }
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewport);
        window.visualViewport.removeEventListener("scroll", updateViewport);
      }
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  // Interests
  const [interests, setInterests] = useInterests();
  const [interestInput, setInterestInput] = useState("");
  const interestsRef = useRef(interests);
  useEffect(() => {
    interestsRef.current = interests;
  }, [interests]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const remoteMediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<WebRTCOfferPayload | null>(null);
  const currentMatchRef = useRef<MatchInfo | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const lastActionTimeRef = useRef<number>(0);
  const lastSendTimeRef = useRef<number>(0);

  // Keep currentMatchRef in sync
  useEffect(() => {
    currentMatchRef.current = currentMatch;
  }, [currentMatch]);

  // Dynamically fetch STUN/TURN servers on mount
  useEffect(() => {
    fetchIceServers()
      .then((servers) => {
        if (servers && servers.length > 0) {
          iceServersRef.current = servers;
        }
      })
      .catch(() => {});
  }, []);

  // Flush queued ICE candidates after remoteDescription is set
  const flushIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (iceCandidateQueueRef.current.length > 0) {
      debugLog(`[ICE] Flushing ${iceCandidateQueueRef.current.length} queued candidates`);
    }
    const candidates = [...iceCandidateQueueRef.current];
    iceCandidateQueueRef.current = [];
    for (const candidateInit of candidates) {
      if (candidateInit && candidateInit.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          debugLog("[ICE] Queued candidate applied successfully");
        } catch (err) {
          console.warn("[ICE] Handled error applying queued candidate:", err);
        }
      }
    }
  }, []);

  // Real-time modular long-hair detection on active local video stream
  useHairDetection({
    videoRef: localVideoRef,
    sessionId: session?.sessionId,
    userId: session?.userId,
    enabled: mode === "video" && mediaStatus === "ready" && !isVideoMuted,
    fps: 5,
  });

  // Clean up WebRTC peer connection
  const cleanupPeerConnection = useCallback((clearQueues = false) => {
    if (clearQueues) {
      iceCandidateQueueRef.current = [];
      pendingOfferRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.onicegatheringstatechange = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.onsignalingstatechange = null;
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
    if (remoteMediaStreamRef.current) {
      try {
        remoteMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      remoteMediaStreamRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setRemoteStreamActive(false);
    setRemoteAutoplayBlocked(false);
  }, []);

  // Ensure local video element srcObject is bound whenever localStream changes
  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream) {
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
        }
        localVideoRef.current.play().catch(() => {});
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream]);

  // Ensure remote video element srcObject is bound whenever remote stream becomes active
  useEffect(() => {
    if (remoteStreamActive && remoteVideoRef.current && remoteMediaStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteMediaStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteMediaStreamRef.current;
        remoteVideoRef.current.play().catch(() => {
          setRemoteAutoplayBlocked(true);
        });
      }
    }
  }, [remoteStreamActive]);

  // Clean up peer connection and media on component unmount (BUG-001: emit LEAVE_QUEUE & STOP)
  useEffect(() => {
    return () => {
      try {
        const socket = connectSocket();
        socket.emit(SocketEvents.LEAVE_QUEUE);
        socket.emit(SocketEvents.STOP);
      } catch (err) {
        console.error("[ChatRoom] Error leaving queue/match on unmount:", err);
      }
      cleanupPeerConnection(true);
      releaseMedia();
    };
  }, [cleanupPeerConnection, releaseMedia]);

  // Re-acquired tracks attached to active peer connection (BUG-003)
  useEffect(() => {
    if (
      chatState === ChatState.CONNECTED &&
      peerConnectionRef.current &&
      peerConnectionRef.current.connectionState !== "closed"
    ) {
      const pc = peerConnectionRef.current;
      const videoTrack = localStream?.getVideoTracks()[0] || null;
      const audioTrack = localStream?.getAudioTracks()[0] || null;

      pc.getSenders().forEach((sender) => {
        const transceiver = pc.getTransceivers?.().find((t) => t.sender === sender);
        const kind = sender.track?.kind || transceiver?.receiver?.track?.kind;

        if (kind === "video") {
          if (videoTrack && sender.track !== videoTrack) {
            sender.replaceTrack(videoTrack).catch(() => {});
          }
        } else if (kind === "audio") {
          if (audioTrack && sender.track !== audioTrack) {
            sender.replaceTrack(audioTrack).catch(() => {});
          }
        }
      });
    }
  }, [localStream, chatState]);

  // Mobile background / lock video resumption (BUG-009)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        localVideoRef.current?.play().catch(() => {});
        remoteVideoRef.current?.play().catch(() => setRemoteAutoplayBlocked(true));
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Fullscreen remote video
  const toggleFullscreen = () => {
    if (!remoteVideoContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      remoteVideoContainerRef.current.requestFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Setup WebRTC peer connection when matched in video mode
  const setupPeerConnection = useCallback(
    async (isInitiator: boolean) => {
      if (mode !== "video") return;
      cleanupPeerConnection(false);

      const socket = connectSocket();
      const pcConfig: RTCConfiguration = {
        iceServers: iceServersRef.current.length > 0 ? iceServersRef.current : DEFAULT_ICE_SERVERS,
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        iceTransportPolicy: "all",
      };
      debugLog("[WEBRTC] Initializing RTCPeerConnection (isInitiator:", isInitiator, ")");
      const pc = new RTCPeerConnection(pcConfig);
      peerConnectionRef.current = pc;

      // Ensure localStream tracks are attached
      const stream = localStream;
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, stream);
          } catch {
            // track already added
          }
        });
        debugLog("[WEBRTC] local tracks added to peer connection:", stream.getTracks().map((t) => t.kind));
      } else {
        // Pre-allocate transceivers to ensure SDP negotiation succeeds
        try {
          pc.addTransceiver("video", { direction: "sendrecv" });
          pc.addTransceiver("audio", { direction: "sendrecv" });
          debugLog("[WEBRTC] Transceivers pre-allocated (sendrecv)");
        } catch {}
      }

      pc.ontrack = (event) => {
        debugLog("[MEDIA] ontrack received:", event.track?.kind, "ID:", event.track?.id);
        let remoteStream = remoteMediaStreamRef.current;
        if (!remoteStream) {
          remoteStream = new MediaStream();
          remoteMediaStreamRef.current = remoteStream;
        }
        if (event.track) {
          if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
            remoteStream.addTrack(event.track);
          }
        }
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((t) => {
            if (!remoteStream!.getTracks().some((existing) => existing.id === t.id)) {
              remoteStream!.addTrack(t);
            }
          });
        }
        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
          remoteVideoRef.current.play().catch((err) => {
            console.warn("[MEDIA] Remote video playback waiting for user gesture:", err);
            setRemoteAutoplayBlocked(true);
          });
        }
        debugLog("[MEDIA] remote stream attached. Total tracks:", remoteStream.getTracks().length);
        setRemoteStreamActive(true);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate) {
          debugLog("[SIGNALING] ICE candidate sent:", event.candidate.candidate.substring(0, 48), "...");
          socket.emit(SocketEvents.ICE_CANDIDATE, {
            matchId: currentMatchRef.current?.matchId,
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          } as ICECandidatePayload);
        }
      };

      pc.oniceconnectionstatechange = async () => {
        const state = pc.iceConnectionState;
        debugLog("[ICE] iceConnectionState changed:", state);
        if (state === "failed") {
          console.warn("[ICE] connection state failed, restarting ICE...");
          try {
            if (pc.restartIce) {
              pc.restartIce();
            }
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            debugLog("[SIGNALING] ICE restart offer sent to partner");
            socket.emit(SocketEvents.WEBRTC_OFFER, {
              matchId: currentMatchRef.current?.matchId,
              sdp: offer.sdp || "",
            } as WebRTCOfferPayload);
          } catch (err) {
            console.error("[WebRTC] Error during ICE restart renegotiation:", err);
          }
        }
      };

      pc.onicegatheringstatechange = () => {
        debugLog("[ICE] iceGatheringState changed:", pc.iceGatheringState);
      };

      pc.onconnectionstatechange = () => {
        debugLog("[PEER] connectionState changed:", pc.connectionState);
      };

      pc.onsignalingstatechange = () => {
        debugLog("[PEER] signalingState changed:", pc.signalingState);
      };

      // Check if an offer already arrived while peerConnection was being constructed
      if (!isInitiator && pendingOfferRef.current) {
        const pending = pendingOfferRef.current;
        pendingOfferRef.current = null;
        try {
          debugLog("[SIGNALING] Applying buffered offer in setupPeerConnection");
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: pending.sdp }));
          await flushIceCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          debugLog("[SIGNALING] answer sent to partner (from buffered offer)");
          socket.emit(SocketEvents.WEBRTC_ANSWER, {
            matchId: currentMatchRef.current?.matchId || pending.matchId,
            sdp: answer.sdp || "",
          } as WebRTCAnswerPayload);
        } catch (err) {
          console.error("[WebRTC] Error processing buffered offer in setup:", err);
        }
      } else if (isInitiator) {
        try {
          debugLog("[SIGNALING] Creating offer as initiator");
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          debugLog("[SIGNALING] offer sent to partner");
          socket.emit(SocketEvents.WEBRTC_OFFER, {
            matchId: currentMatchRef.current?.matchId,
            sdp: offer.sdp || "",
          } as WebRTCOfferPayload);
        } catch (err) {
          console.error("[WebRTC] Error creating offer:", err);
        }
      }
    },
    [mode, localStream, cleanupPeerConnection, flushIceCandidates]
  );

  // Start chat - join matchmaking queue only after media is guaranteed ready
  const startChat = useCallback(async () => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < 400) {
      return;
    }
    lastActionTimeRef.current = now;

    if (mode === "video") {
      let activeStream = localStream;
      if (!activeStream || mediaStatus !== "ready") {
        activeStream = await acquireMedia({ userInitiated: true });
        if (!activeStream) {
          // Permissions denied or device error: stay in recoverable error state
          return;
        }
      }
    }

    cleanupPeerConnection(true);
    currentMatchRef.current = null;
    setCurrentMatch(null);
    setSharedInterest(null);
    setChatState(ChatState.SEARCHING);
    setStopConfirm(false);

    const socket = connectSocket();

    const activeInterests = interestsRef.current;
    setMessages([
      {
        id: createUniqueId("sys"),
        sender: "system",
        text:
          activeInterests.length > 0
            ? `Searching for strangers interested in: #${activeInterests.join(", #")}...`
            : "Looking for someone to chat with worldwide...",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    socket.emit(SocketEvents.JOIN_QUEUE, {
      mode,
      interests: activeInterests,
    });
  }, [mode, localStream, mediaStatus, acquireMedia, cleanupPeerConnection]);

  // Next stranger - reuses existing local camera stream without re-prompting
  const handleNext = useCallback(async () => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < 400) {
      return;
    }
    lastActionTimeRef.current = now;

    if (mode === "video" && (!localStream || mediaStatus !== "ready")) {
      const activeStream = await acquireMedia({ userInitiated: true });
      if (!activeStream) return;
    }

    cleanupPeerConnection(true);
    const socket = connectSocket();
    socket.emit(SocketEvents.NEXT);
    setStopConfirm(false);
    setSharedInterest(null);
    currentMatchRef.current = null;
    setCurrentMatch(null);
    setChatState(ChatState.SEARCHING);

    const activeInterests = interestsRef.current;
    setMessages([
      {
        id: createUniqueId("sys"),
        sender: "system",
        text:
          activeInterests.length > 0
            ? `Searching for strangers interested in: #${activeInterests.join(", #")}...`
            : "Looking for someone to chat with worldwide...",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    socket.emit(SocketEvents.JOIN_QUEUE, {
      mode,
      interests: activeInterests,
    });
  }, [cleanupPeerConnection, mode, localStream, mediaStatus, acquireMedia]);

  // Stop chat - keeps local preview active so user can re-engage seamlessly
  const handleStop = useCallback(() => {
    if (!stopConfirm && chatState === ChatState.CONNECTED) {
      setStopConfirm(true);
      return;
    }
    setStopConfirm(false);
    cleanupPeerConnection(true);
    const socket = connectSocket();
    socket.emit(SocketEvents.STOP);
    currentMatchRef.current = null;
    setCurrentMatch(null);
    setChatState(ChatState.IDLE);
    setMessages((prev) => [
      ...prev,
      {
        id: createUniqueId("sys"),
        sender: "system",
        text: "You have stopped the chat.",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  }, [stopConfirm, chatState, cleanupPeerConnection]);

  // 1. Initialize privacy-safe anonymous session on component mount & auto-start
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    let unmounted = false;

    initAnonymousSession(mode).then((sess) => {
      if (unmounted) return;
      let socket;
      if (sess) {
        setSession(sess);
        socket = connectSocket(sess.sessionToken);
      } else {
        socket = connectSocket();
      }

      if (autoStart && !hasAutoStartedRef.current) {
        if (mode === "text") {
          hasAutoStartedRef.current = true;
          socket.emit(SocketEvents.JOIN_QUEUE, {
            mode,
            interests: interestsRef.current,
          });
        } else if (mode === "video") {
          // In video mode: check if permissions were already granted previously
          checkPermissionState().then((perm) => {
            if (unmounted) return;
            if (perm === "granted") {
              acquireMedia().then((stream) => {
                if (unmounted) return;
                if (stream && !hasAutoStartedRef.current) {
                  hasAutoStartedRef.current = true;
                  setChatState(ChatState.SEARCHING);
                  const activeInterests = interestsRef.current;
                  setMessages([
                    {
                      id: createUniqueId("sys"),
                      sender: "system",
                      text:
                        activeInterests.length > 0
                          ? `Searching for strangers interested in: #${activeInterests.join(", #")}...`
                          : "Looking for someone to chat with worldwide...",
                      time: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    },
                  ]);
                  const s = connectSocket();
                  s.emit(SocketEvents.JOIN_QUEUE, {
                    mode,
                    interests: activeInterests,
                  });
                }
              });
            } else {
              // Permission is 'prompt' or ungranted: keep in IDLE with prominent prompt
              setChatState(ChatState.IDLE);
            }
          });
        }
      }
    });

    return () => {
      unmounted = true;
    };
  }, [mode, autoStart, checkPermissionState, acquireMedia]);

  // 2. Handle Socket.IO events (including session continuity & graceful reconnect)
  useEffect(() => {
    const socket = connectSocket();

    const handleSessionEstablished = (payload: { sessionId: string; userId?: string; sessionToken: string }) => {
      setSession((prev) => ({
        sessionId: payload.sessionId,
        userId: payload.userId || prev?.userId,
        sessionToken: payload.sessionToken,
        status: prev?.status || "idle",
        expiresAt: prev?.expiresAt || Date.now() + 7200000,
      }));
    };

    const handlePeerReconnecting = () => {
      setPeerReconnecting(true);
      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys"),
          sender: "system",
          text: "Partner connection interrupted. Reconnecting...",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    };

    const handlePeerReconnected = (payload?: { isInitiator?: boolean }) => {
      setPeerReconnecting(false);
      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys"),
          sender: "system",
          text: "Partner reconnected!",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      if (mode === "video") {
        setupPeerConnection(payload?.isInitiator ?? false);
      }
    };

    const handleMatchReconnected = (payload: {
      matchId: string;
      partnerId: string;
      isInitiator: boolean;
      sharedInterest: string | null;
    }) => {
      setPeerReconnecting(false);
      const matchInfo: MatchInfo = {
        matchId: payload.matchId,
        partnerId: payload.partnerId,
        isInitiator: payload.isInitiator,
      };

      currentMatchRef.current = matchInfo;
      setCurrentMatch(matchInfo);
      setSharedInterest(payload.sharedInterest);
      setChatState(ChatState.CONNECTED);

      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys"),
          sender: "system",
          text: "Reconnected to active session!",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      if (mode === "video") {
        setupPeerConnection(payload.isInitiator);
      }
    };

    const handleSessionExpired = () => {
      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys"),
          sender: "system",
          text: "Anonymous session expired. Refreshing anonymous session...",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      initAnonymousSession(mode).then((newSess) => {
        if (newSess) {
          setSession(newSess);
          connectSocket(newSess.sessionToken);
        }
      });
    };

    const handleMatchFound = (payload: {
      matchId: string;
      partnerId: string;
      isInitiator: boolean;
      sharedInterest: string | null;
      sharedInterests?: string[];
    }) => {
      setPeerReconnecting(false);
      const matchInfo: MatchInfo = {
        matchId: payload.matchId,
        partnerId: payload.partnerId,
        isInitiator: payload.isInitiator,
      };

      currentMatchRef.current = matchInfo;
      setCurrentMatch(matchInfo);
      const primaryShared = payload.sharedInterest || (payload.sharedInterests && payload.sharedInterests[0]) || null;
      setSharedInterest(primaryShared);
      setChatState(ChatState.CONNECTED);

      const allShared = payload.sharedInterests && payload.sharedInterests.length > 0
        ? payload.sharedInterests
        : primaryShared ? [primaryShared] : [];

      const sysText = allShared.length > 0
        ? `You both like #${allShared.join(", #")}! Say hello to your stranger.`
        : "You are now connected with a random stranger. Say hi!";

      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys"),
          sender: "system",
          text: sysText,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      if (mode === "video") {
        setupPeerConnection(payload.isInitiator);
      }
    };

    const handleMessageReceived = (payload: MessageReceivedPayload) => {
      setMessages((prev) => [
        ...prev,
        {
          id: payload.id || createUniqueId("stranger"),
          sender: "stranger",
          text: payload.content,
          time: new Date(payload.timestamp || Date.now()).toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
          ),
        },
      ]);
    };

    const handleWebRTCOffer = async (payload: WebRTCOfferPayload) => {
      if (mode !== "video") return;
      debugLog("[SIGNALING] offer received from partner");
      const pc = peerConnectionRef.current;
      if (!pc) {
        debugLog("[SIGNALING] peerConnection not ready yet, queuing incoming offer");
        pendingOfferRef.current = payload;
        return;
      }
      try {
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-remote-offer") {
          try {
            await pc.setLocalDescription({ type: "rollback" });
          } catch {}
        }

        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: payload.sdp })
        );
        await flushIceCandidates(pc);

        // Ensure local stream tracks are attached to sender transceivers if ready
        if (localStream) {
          const stream = localStream;
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
          let videoAttached = false;
          let audioAttached = false;

          transceivers.forEach((t) => {
            const isVideo = t.receiver.track?.kind === "video" || t.sender.track?.kind === "video";
            const isAudio = t.receiver.track?.kind === "audio" || t.sender.track?.kind === "audio";
            if (isVideo && videoTrack) {
              t.sender.replaceTrack(videoTrack).catch(() => {});
              t.direction = "sendrecv";
              videoAttached = true;
            } else if (isAudio && audioTrack) {
              t.sender.replaceTrack(audioTrack).catch(() => {});
              t.direction = "sendrecv";
              audioAttached = true;
            }
          });

          if (!videoAttached && videoTrack) {
            try { pc.addTrack(videoTrack, stream); } catch {}
          }
          if (!audioAttached && audioTrack) {
            try { pc.addTrack(audioTrack, stream); } catch {}
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        debugLog("[SIGNALING] answer sent to partner");
        socket.emit(SocketEvents.WEBRTC_ANSWER, {
          matchId: currentMatchRef.current?.matchId || payload.matchId,
          sdp: answer.sdp || "",
        } as WebRTCAnswerPayload);
      } catch (err) {
        console.error("[WebRTC] Error handling offer:", err);
      }
    };

    const handleWebRTCAnswer = async (payload: WebRTCAnswerPayload) => {
      if (mode !== "video") return;
      debugLog("[SIGNALING] answer received from partner");
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: payload.sdp })
          );
          await flushIceCandidates(pc);
          debugLog("[SIGNALING] Remote answer description set successfully");
        }
      } catch (err) {
        console.error("[WebRTC] Error handling answer:", err);
      }
    };

    const handleICECandidate = async (payload: ICECandidatePayload) => {
      if (mode !== "video") return;
      if (!payload?.candidate) return;
      debugLog("[SIGNALING] ICE candidate received:", payload.candidate.substring(0, 48), "...");

      const candidateInit: RTCIceCandidateInit = {
        candidate: payload.candidate,
        sdpMLineIndex: payload.sdpMLineIndex !== undefined ? payload.sdpMLineIndex : null,
        sdpMid: payload.sdpMid !== undefined ? payload.sdpMid : null,
      };
      const pc = peerConnectionRef.current;
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
        debugLog("[ICE] Remote description not set yet, queuing candidate");
        iceCandidateQueueRef.current.push(candidateInit);
      } else {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          debugLog("[ICE] Candidate applied to peer connection");
        } catch (err) {
          console.warn("[ICE] Handled error adding candidate:", err);
        }
      }
    };

    const handleSocketError = (payload: { message?: string } | string) => {
      const errMsg =
        typeof payload === "string"
          ? payload
          : payload?.message || "An error occurred with the chat connection.";
      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys-err"),
          sender: "system",
          text: `⚠️ Error: ${errMsg}`,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    };

    const handleMatchEnded = (payload?: MatchEndedPayload) => {
      cleanupPeerConnection(true);
      currentMatchRef.current = null;
      setCurrentMatch(null);
      setPeerReconnecting(false);
      setChatState(ChatState.ENDED);
      const reasonMsg =
        payload?.reason === "reported"
          ? "Stranger has been reported and disconnected."
          : "Stranger has disconnected.";

      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys"),
          sender: "system",
          text: reasonMsg,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    };

    socket.on("session_established", handleSessionEstablished);
    socket.on(SocketEvents.PEER_RECONNECTING, handlePeerReconnecting);
    socket.on(SocketEvents.PEER_RECONNECTED, handlePeerReconnected);
    socket.on(SocketEvents.MATCH_RECONNECTED, handleMatchReconnected);
    socket.on(SocketEvents.SESSION_EXPIRED, handleSessionExpired);
    socket.on(SocketEvents.MATCH_FOUND, handleMatchFound);
    socket.on(SocketEvents.MESSAGE_RECEIVED, handleMessageReceived);
    socket.on(SocketEvents.WEBRTC_OFFER, handleWebRTCOffer);
    socket.on(SocketEvents.WEBRTC_ANSWER, handleWebRTCAnswer);
    socket.on(SocketEvents.ICE_CANDIDATE, handleICECandidate);
    socket.on(SocketEvents.ERROR, handleSocketError);
    socket.on(SocketEvents.MATCH_ENDED, handleMatchEnded);
    socket.on(SocketEvents.PARTNER_DISCONNECTED, handleMatchEnded);

    return () => {
      socket.off("session_established", handleSessionEstablished);
      socket.off(SocketEvents.PEER_RECONNECTING, handlePeerReconnecting);
      socket.off(SocketEvents.PEER_RECONNECTED, handlePeerReconnected);
      socket.off(SocketEvents.MATCH_RECONNECTED, handleMatchReconnected);
      socket.off(SocketEvents.SESSION_EXPIRED, handleSessionExpired);
      socket.off(SocketEvents.MATCH_FOUND, handleMatchFound);
      socket.off(SocketEvents.MESSAGE_RECEIVED, handleMessageReceived);
      socket.off(SocketEvents.WEBRTC_OFFER, handleWebRTCOffer);
      socket.off(SocketEvents.WEBRTC_ANSWER, handleWebRTCAnswer);
      socket.off(SocketEvents.ICE_CANDIDATE, handleICECandidate);
      socket.off(SocketEvents.ERROR, handleSocketError);
      socket.off(SocketEvents.MATCH_ENDED, handleMatchEnded);
      socket.off(SocketEvents.PARTNER_DISCONNECTED, handleMatchEnded);
    };
  }, [mode, localStream, cleanupPeerConnection, setupPeerConnection, flushIceCandidates]);

  // Keyboard shortcut: ESC skips/stops/starts, or dismisses open modals
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showReportModal) {
          setShowReportModal(false);
          return;
        }
        if (showInterestsModal) {
          setShowInterestsModal(false);
          return;
        }
        if (showPremiumModal) {
          setShowPremiumModal(false);
          return;
        }
        if (chatState === ChatState.CONNECTED) {
          handleNext();
        } else if (chatState === ChatState.IDLE || chatState === ChatState.ENDED) {
          startChat();
        } else if (chatState === ChatState.SEARCHING) {
          handleStop();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    chatState,
    handleNext,
    startChat,
    handleStop,
    showReportModal,
    showInterestsModal,
    showPremiumModal,
  ]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = useCallback(
    (e?: React.FormEvent, customText?: string) => {
      e?.preventDefault();
      const text = (customText ?? inputMessage).trim();
      if (!text || chatState !== ChatState.CONNECTED) return;
      const now = Date.now();
      if (now - lastSendTimeRef.current < 150) return;
      lastSendTimeRef.current = now;
      if (text.length > 500) {
        setMessages((prev) => [
          ...prev,
          {
            id: createUniqueId("sys-err"),
            sender: "system",
            text: "⚠️ Message exceeds maximum length of 500 characters.",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        return;
      }

      const socket = connectSocket();
      const newMsg: Message = {
        id: createUniqueId("msg"),
        sender: "you",
        text,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, newMsg]);
      if (!customText) setInputMessage("");

      socket.emit(SocketEvents.SEND_MESSAGE, { content: text });
    },
    [inputMessage, chatState]
  );

  // Submit report
  const submitReport = () => {
    setReportSubmitted(true);
    const socket = connectSocket();

    socket.emit(SocketEvents.REPORT_USER, {
      reason: selectedReportReason,
    });

    setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
      handleNext();
    }, 1000);
  };

  const syncQueueInterests = useCallback(
    (newInterests: string[]) => {
      if (chatState === ChatState.SEARCHING) {
        const socket = connectSocket();
        socket.emit(SocketEvents.JOIN_QUEUE, {
          mode,
          interests: newInterests,
        });
        setMessages([
          {
            id: createUniqueId("sys"),
            sender: "system",
            text:
              newInterests.length > 0
                ? `Searching for strangers interested in: #${newInterests.join(", #")}...`
                : "Looking for someone to chat with worldwide...",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      }
    },
    [chatState, mode]
  );

  const handleAddInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interestInput.trim()) return;
    const newTags = parseAndNormalizeInterests(interestInput);
    if (newTags.length > 0) {
      const updated = Array.from(new Set([...interests, ...newTags])).slice(0, 10);
      setInterests(updated);
      setInterestInput("");
      syncQueueInterests(updated);
    }
  };

  const handleRemoveInterest = (tag: string) => {
    const updated = interests.filter((t) => t !== tag);
    setInterests(updated);
    syncQueueInterests(updated);
  };

  const handleToggleInterest = (tag: string) => {
    if (interests.includes(tag)) {
      handleRemoveInterest(tag);
    } else {
      const updated = Array.from(new Set([...interests, tag])).slice(0, 10);
      setInterests(updated);
      syncQueueInterests(updated);
    }
  };

  const handleClearAllInterests = () => {
    setInterests([]);
    syncQueueInterests([]);
  };

  return (
    <div
      style={{ height: viewportHeight ? `${viewportHeight}px` : undefined }}
      className="flex h-screen h-dvh max-h-screen max-h-dvh w-full flex-col overflow-hidden bg-[#fdfbf7] dark:bg-[#121016] text-[#111827] dark:text-[#f4f4f7] select-none"
    >
      {/* Universal Header (hidden on mobile when virtual keyboard is open) */}
      <div className={isKeyboardOpen ? "hidden md:block" : "shrink-0"}>
        <Header />
      </div>

      {/* Main Page Layout Container */}
      <main className="flex-1 min-h-0 min-w-0 w-full flex flex-col px-2 sm:px-3 lg:px-4 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] overflow-hidden">
        <div className="flex flex-1 min-h-0 min-w-0 w-full flex-col md:flex-row mobile-landscape:flex-row gap-1.5 sm:gap-2.5 lg:gap-3 overflow-hidden">
          
          {/* ================================================================= */}
          {/* LEFT COLUMN: Dual Video Feeds (Desktop & Mobile Optimized)       */}
          {/* ================================================================= */}
          {mode === "video" && (
            <div className="shrink-0 flex flex-col w-full md:w-[380px] lg:w-[430px] xl:w-[480px] 2xl:w-[520px] mobile-landscape:w-[48%] mobile-landscape:h-full md:h-full gap-1 sm:gap-2 overflow-hidden">
              
              {/* Mobile View Toggle Bar (Only visible on small portrait screens < md) */}
              <div className="flex md:hidden mobile-landscape:hidden items-center justify-between px-1 shrink-0 h-6 min-h-[24px]">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${chatState === ChatState.CONNECTED ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                  {chatState === ChatState.CONNECTED ? "Connected" : chatState === ChatState.SEARCHING ? "Searching..." : "Preview"}
                </span>

                <div className="flex items-center gap-0.5 bg-amber-100/70 dark:bg-white/10 rounded-lg p-0.5 text-[10px] font-medium border border-amber-200/50 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setMobileViewMode("pip")}
                    className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${mobileViewMode === "pip" ? "bg-white dark:bg-[#1a1827] text-[#f43f5e] dark:text-[#fb7185] font-bold shadow-xs" : "text-gray-600 dark:text-gray-400"}`}
                  >
                    PiP View
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileViewMode("split")}
                    className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${mobileViewMode === "split" ? "bg-white dark:bg-[#1a1827] text-[#f43f5e] dark:text-[#fb7185] font-bold shadow-xs" : "text-gray-600 dark:text-gray-400"}`}
                  >
                    Split View
                  </button>
                </div>
              </div>

              {/* Video Feeds Wrapper */}
              <div
                className={`w-full overflow-hidden transition-all duration-200 ${
                  mobileViewMode === "pip"
                    ? isKeyboardOpen
                      ? "relative h-[85px] mobile-landscape:h-full md:h-full md:flex md:flex-col md:gap-2.5"
                      : "relative h-[clamp(130px,23dvh,195px)] mobile-landscape:h-full md:h-full md:flex md:flex-col md:gap-2.5"
                    : isKeyboardOpen
                    ? "grid grid-cols-2 gap-1.5 h-[80px] mobile-landscape:h-full md:h-full md:flex md:flex-col md:gap-2.5"
                    : "grid grid-cols-2 gap-1.5 sm:gap-2 h-[clamp(115px,20dvh,175px)] mobile-landscape:h-full md:h-full md:flex md:flex-col md:gap-2.5"
                }`}
              >
                {/* 1. STRANGER / REMOTE VIDEO CARD */}
                <div
                  ref={remoteVideoContainerRef}
                  onClick={() => {
                    if (remoteVideoRef.current && remoteStreamActive) {
                      remoteVideoRef.current.play().catch(() => {});
                    }
                  }}
                  className="relative w-full h-full md:h-auto md:flex-1 md:basis-0 min-h-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-gray-200/90 dark:border-white/10 bg-[#3f3f46] dark:bg-[#2b2b33] flex items-center justify-center shadow-2xs select-none"
                >
                  {/* Stranger Reconnecting Grace Period Overlay */}
                  {peerReconnecting && (
                    <div className="absolute top-2.5 inset-x-2.5 sm:top-3 sm:inset-x-3 z-30 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-600/95 text-white text-xs font-semibold backdrop-blur-md shadow-lg border border-amber-400/40 animate-pulse">
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Stranger reconnecting...</span>
                      </div>
                    </div>
                  )}

                  {/* Real WebRTC Remote Video Stream */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 pointer-events-none ${
                      remoteStreamActive && chatState === ChatState.CONNECTED
                        ? "opacity-100 z-10"
                        : "opacity-0 z-0"
                    }`}
                  />

                  {/* Remote Video Autoplay Blocked Overlay (Mobile Safari & Android WebKit) */}
                  {remoteAutoplayBlocked && chatState === ChatState.CONNECTED && (
                    <button
                      type="button"
                      onClick={() => {
                        if (remoteVideoRef.current) {
                          remoteVideoRef.current
                            .play()
                            .then(() => setRemoteAutoplayBlocked(false))
                            .catch(() => {});
                        }
                      }}
                      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs text-white p-4 text-center cursor-pointer select-none"
                    >
                      <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white shadow-xl mb-2 animate-bounce">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                      <span className="text-xs sm:text-sm font-extrabold text-white">Tap to Play Video &amp; Audio</span>
                      <span className="text-[10px] text-gray-300 mt-0.5">Your browser requires a tap to start sound</span>
                    </button>
                  )}

                  {/* Remote State: IDLE - Clean charcoal canvas matching reference image */}

                  {/* Remote State: SEARCHING (High-tech pulsing radar animation) */}
                  {chatState === ChatState.SEARCHING && (
                    <div className="relative flex flex-col items-center justify-center text-center p-4 z-10">
                      <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-2 sm:mb-3">
                        <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
                        <div className="absolute inset-2 rounded-full bg-orange-500/30 animate-pulse" />
                        <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg shadow-rose-500/30">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                        </div>
                      </div>

                      <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                        Looking for a partner...
                      </span>
                      {interests.length > 0 ? (
                        <div className="mt-1 flex flex-wrap justify-center gap-1 max-w-[240px]">
                          {interests.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[10px] text-rose-200 font-medium bg-rose-500/30 px-1.5 py-0.5 rounded-md">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-300 mt-0.5">Connecting worldwide</span>
                      )}

                      <button
                        onClick={handleStop}
                        type="button"
                        className="mt-2.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Remote State: CONNECTED without video track yet */}
                  {chatState === ChatState.CONNECTED && !remoteStreamActive && (
                    <div className="relative flex flex-col items-center justify-center text-center p-4">
                      <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 shadow-lg text-white mb-2 animate-pulse">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sm:w-7 sm:h-7">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-xs">
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-semibold">Stranger</span>
                      </div>
                      <span className="text-[11px] text-gray-300 mt-1">Connecting video...</span>
                    </div>
                  )}

                  {/* Remote State: ENDED */}
                  {chatState === ChatState.ENDED && (
                    <div className="flex flex-col items-center justify-center p-3 text-center z-10">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 mb-1.5">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-gray-200">Stranger Disconnected</span>
                      <button
                        onClick={handleNext}
                        type="button"
                        className="mt-2.5 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-rose-500/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                      >
                        <span>Next Stranger</span>
                        <kbd className="px-1 text-[10px] rounded bg-white/20 font-mono">Esc</kbd>
                      </button>
                    </div>
                  )}

                  {/* Connected Status Overlay Pill (Top-left when connected) */}
                  {chatState === ChatState.CONNECTED && (
                    <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[10px] sm:text-xs text-white border border-white/10 shadow-xs z-20 pointer-events-auto">
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-semibold">Stranger</span>
                      {sharedInterest && (
                        <span className="ml-1 text-amber-300 font-bold">#{sharedInterest}</span>
                      )}
                    </div>
                  )}

                  {/* BOTTOM-LEFT WATERMARK: V Mingle Branding */}
                  <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 flex items-center gap-1.5 select-none pointer-events-none z-20">
                    <div className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-md bg-white p-0.5 shadow-xs overflow-hidden">
                      <Image
                        src="/favicon.png"
                        alt="V Mingle"
                        width={20}
                        height={20}
                        unoptimized
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span className="text-xs sm:text-sm font-black text-white tracking-tight drop-shadow-xs">
                      vmingle<span className="font-normal opacity-85">.in</span>
                    </span>
                  </div>

                  {/* TOP-RIGHT CONTROLS: Fullscreen */}
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1.5 z-20">
                    <button
                      onClick={toggleFullscreen}
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-gray-300 hover:text-white hover:bg-black/80 transition-colors cursor-pointer border border-white/10"
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      id="fullscreen-toggle-btn"
                    >
                      {isFullscreen ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* BOTTOM-RIGHT FLAG (Report user): Exact match to reference screenshot */}
                  <button
                    onClick={() => setShowReportModal(true)}
                    type="button"
                    className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 flex h-8 w-8 items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer z-20"
                    title="Report user"
                    aria-label="Report user"
                    id="report-flag-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                  </button>
                </div>

                {/* 2. LOCAL SELF VIDEO CARD (Picture-in-Picture on mobile or stacked on desktop) */}
                <div
                  className={`group overflow-hidden rounded-xl sm:rounded-3xl border border-gray-200/90 dark:border-white/10 bg-[#12111a] flex items-center justify-center shadow-2xs select-none transition-all ${
                    mobileViewMode === "pip"
                      ? isKeyboardOpen
                        ? "absolute bottom-1 right-1 w-16 h-20 rounded-lg z-30 shadow-xl ring-2 ring-black/50 md:relative md:bottom-auto md:right-auto md:w-full md:h-auto md:flex-1 md:basis-0 md:min-h-0 md:rounded-2xl sm:md:rounded-3xl md:ring-0"
                        : "absolute bottom-1.5 right-1.5 w-20 h-28 min-[380px]:w-24 min-[380px]:h-32 sm:w-28 sm:h-36 rounded-xl z-30 shadow-xl ring-2 ring-black/50 md:relative md:bottom-auto md:right-auto md:w-full md:h-auto md:flex-1 md:basis-0 md:min-h-0 md:rounded-2xl sm:md:rounded-3xl md:ring-0"
                      : "relative w-full h-full md:h-auto md:flex-1 md:basis-0 min-h-0 rounded-xl sm:rounded-3xl"
                  }`}
                >
                  {/* Mirrored Local Video Element */}
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${
                      isMirrored ? "-scale-x-100" : ""
                    }`}
                  />

                  {/* Audio-only or Video-only Hardware Indicator Badge */}
                  {audioOnly && mediaStatus === "ready" && (
                    <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold text-white shadow-xs backdrop-blur-xs">
                      <span>🎙️</span>
                      <span>Audio Only</span>
                    </div>
                  )}
                  {videoOnly && mediaStatus === "ready" && (
                    <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold text-white shadow-xs backdrop-blur-xs">
                      <span>📹</span>
                      <span>Video Only (No Mic)</span>
                    </div>
                  )}

                  {/* Camera Paused / Turned Off State */}
                  {isVideoMuted && mediaStatus === "ready" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-25">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-gray-300 mb-1">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-white">Camera is Off</span>
                      <button
                        onClick={() => toggleVideo(false)}
                        type="button"
                        className="mt-1 px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-[9px] font-semibold text-white cursor-pointer"
                      >
                        Turn On
                      </button>
                    </div>
                  )}

                  {/* Media Permission State: Requesting (User prompt pending) */}
                  {mediaStatus === "requesting" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 mb-1.5 animate-pulse">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-white mb-0.5">Requesting Access...</span>
                      <p className="text-[9px] text-gray-300 max-w-[200px] leading-tight">
                        Please tap &ldquo;Allow&rdquo; on your browser prompt to connect your camera &amp; microphone.
                      </p>
                    </div>
                  )}

                  {/* Media State: Prompt Required (User has not clicked to start yet) */}
                  {mediaStatus === "prompt" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white mb-1 shadow-xs">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 7l-7 5 7 5V7z" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-white mb-0.5">Camera Required</span>
                      <p className="text-[9px] text-gray-400 max-w-[190px] leading-tight mb-2">
                        Click Enable Camera or Start to begin.
                      </p>
                      <button
                        onClick={() => acquireMedia({ userInitiated: true })}
                        type="button"
                        className="px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-[9px] sm:text-[10px] font-bold text-white cursor-pointer shadow-xs"
                      >
                        Enable Camera
                      </button>
                    </div>
                  )}

                  {/* Media Permission State: Denied */}
                  {mediaStatus === "denied" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 mb-1">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-gray-200 mb-0.5">Permission Denied</span>
                      <p className="text-[9px] text-gray-400 max-w-[210px] leading-tight mb-2">
                        {mediaErrorMessage || "Camera permission is denied. Click the lock/camera icon in your address bar to allow permissions, then retry."}
                      </p>
                      <button
                        onClick={() => acquireMedia({ userInitiated: true })}
                        type="button"
                        className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-semibold text-white cursor-pointer"
                      >
                        Check &amp; Retry
                      </button>
                    </div>
                  )}

                  {/* Media State: Device Not Found */}
                  {mediaStatus === "not_found" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 mb-1">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-white mb-0.5">No Device Found</span>
                      <p className="text-[9px] text-amber-200/90 max-w-[200px] leading-tight mb-2">
                        {mediaErrorMessage || "No camera or microphone found on this device."}
                      </p>
                      <button
                        onClick={() => acquireMedia({ userInitiated: true })}
                        type="button"
                        className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-semibold text-white cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Media State: Device Busy / In Use in Another App */}
                  {mediaStatus === "not_readable" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 mb-1">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                          <line x1="7" y1="2" x2="7" y2="22" />
                          <line x1="17" y1="2" x2="17" y2="22" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-white mb-0.5">Camera Busy</span>
                      <p className="text-[9px] text-amber-200/90 max-w-[200px] leading-tight mb-2">
                        {mediaErrorMessage || "Camera is in use by another app (Zoom, FaceTime). Close other apps and retry."}
                      </p>
                      <button
                        onClick={() => acquireMedia({ userInitiated: true })}
                        type="button"
                        className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-semibold text-white cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Media State: Insecure Context (HTTP) */}
                  {mediaStatus === "insecure_context" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 mb-1">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-white mb-0.5">HTTPS Required</span>
                      <p className="text-[9px] text-amber-200/90 max-w-[210px] leading-tight mb-2">
                        Browsers block camera &amp; mic over insecure HTTP. Please connect via HTTPS.
                      </p>
                      <button
                        onClick={() => acquireMedia({ userInitiated: true })}
                        type="button"
                        className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-[9px] font-bold text-white cursor-pointer shadow-xs"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Media State: Device Error / Interrupted */}
                  {mediaStatus === "device_error" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 mb-1">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 2 22 22 22" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-white mb-0.5">Device Interrupted</span>
                      <p className="text-[9px] text-gray-400 max-w-[200px] leading-tight mb-2">
                        {mediaErrorMessage || "Device access was interrupted. Click Retry to reconnect."}
                      </p>
                      <button
                        onClick={() => acquireMedia({ userInitiated: true })}
                        type="button"
                        className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-semibold text-white cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Subtle Floating Local Media Controls Toolbar (Camera, Voice & Flip/Switch) */}
                  <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 ${isKeyboardOpen ? "hidden md:flex" : "flex"} items-center gap-1 rounded-full bg-black/70 backdrop-blur-md px-1.5 py-0.5 sm:px-2 sm:py-1 border border-white/10 shadow-lg opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-30`}>
                    {/* Camera Button (Toggle Video Track) */}
                    <button
                      onClick={() => toggleVideo()}
                      type="button"
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors cursor-pointer ${
                        isVideoMuted
                          ? "bg-red-500 text-white"
                          : "text-gray-300 hover:text-white hover:bg-white/20"
                      }`}
                      title={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
                      aria-label={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
                      id="toggle-camera-btn"
                    >
                      {isVideoMuted ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 7l-7 5 7 5V7z" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      )}
                    </button>

                    {/* Voice Button (Toggle Microphone) */}
                    <button
                      onClick={() => toggleAudio()}
                      type="button"
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors cursor-pointer ${
                        isAudioMuted
                          ? "bg-red-500 text-white"
                          : "text-gray-300 hover:text-white hover:bg-white/20"
                      }`}
                      title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
                      aria-label={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
                      id="toggle-audio-btn"
                    >
                      {isAudioMuted ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      )}
                    </button>

                    {/* Flip / Switch Camera Button */}
                    <button
                      onClick={async () => {
                        if (deviceInfo.hasMultipleCameras) {
                          await switchCamera(async (newTrack) => {
                            const pc = peerConnectionRef.current;
                            if (pc && pc.connectionState !== "closed") {
                              const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
                              for (const t of transceivers) {
                                if (t.sender.track?.kind === "video") {
                                  await t.sender.replaceTrack(newTrack).catch(() => {});
                                }
                              }
                            }
                          });
                        } else {
                          setIsMirrored(!isMirrored);
                        }
                      }}
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                      title={deviceInfo.hasMultipleCameras ? "Switch Camera (Front/Back)" : "Flip Video Mirror"}
                      aria-label={deviceInfo.hasMultipleCameras ? "Switch Camera" : "Flip Mirror"}
                      id="flip-camera-btn"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 1 21 5 17 9" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <polyline points="7 23 3 19 7 15" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ================================================================= */}
          {/* RIGHT COLUMN: Chat Stream, Guidelines, & Bottom Action Bar       */}
          {/* ================================================================= */}
          <div className="flex flex-1 min-w-0 min-h-0 flex-col gap-1.5 sm:gap-2.5 lg:gap-3 md:h-full mobile-landscape:h-full overflow-hidden">
            
            {/* Main Content Pane (Welcome Rules Card OR Live Chat Messages) */}
            <div className="relative flex-1 min-h-0 overflow-y-auto rounded-xl sm:rounded-3xl border border-gray-200/90 bg-white p-3 sm:p-6 lg:p-8 shadow-2xs dark:border-white/10 dark:bg-[#151421] overscroll-contain">
              
              {chatState === ChatState.IDLE ? (
                /* ======================================================= */
                /* WELCOME & RULES HERO CARD - EXACT MATCH TO REFERENCE    */
                /* ======================================================= */
                <div className="flex flex-col h-full justify-between select-none">
                  <div>
                    {/* Header */}
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                      Welcome to V Mingle.
                    </h2>

                    {/* Guidelines List */}
                    <div className="mt-3 sm:mt-5 space-y-1.5 sm:space-y-2.5 text-xs sm:text-base lg:text-lg">
                      {/* Age restriction line */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="flex items-center justify-center bg-[#ff3b30] text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded shadow-2xs">
                          18+
                        </span>
                        <span className="text-[#f43f5e] dark:text-[#fb7185] font-bold">
                          You must be 18 or older
                        </span>
                      </div>

                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        No nudity, hate speech, or harassment
                      </p>

                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        {mode === "video" ? "Your camera must show you, live" : "Be respectful, friendly, and authentic"}
                      </p>

                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        Do not ask for gender — this is not a dating site
                      </p>

                      <p className="font-extrabold text-gray-900 dark:text-white">
                        Violators will be banned
                      </p>
                    </div>
                  </div>

                  {/* Primary User-Initiated Start Button */}
                  <div className="mt-3 sm:mt-5 pt-3 border-t border-gray-100 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={startChat}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-rose-500/25 transition-all cursor-pointer"
                      id="welcome-start-chat-btn"
                    >
                      <span>{mode === "video" ? "📹 Start Video Chat" : "💬 Start Text Chat"}</span>
                      <span className="hidden sm:inline px-1 text-[10px] rounded bg-white/20 font-mono">Esc</span>
                    </button>
                    {mode === "video" && mediaStatus !== "ready" && (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Camera &amp; microphone access will be requested
                      </span>
                    )}
                  </div>
                </div>
              ) : chatState === ChatState.SEARCHING && messages.filter((m) => m.sender !== "system").length === 0 ? (
                /* ======================================================= */
                /* HIGH-TECH MATCHMAKING RADAR STATE                       */
                /* ======================================================= */
                <div className="flex flex-col items-center justify-center h-full text-center p-3 sm:p-6 space-y-2 sm:space-y-4">
                  <div className="relative flex items-center justify-center w-14 h-14 sm:w-24 sm:h-24">
                    <div className="absolute inset-0 rounded-full bg-rose-500/15 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-orange-500/25 animate-pulse" />
                    <div className="relative flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white shadow-xl shadow-rose-500/30">
                      <svg className="animate-spin h-5 w-5 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white">
                      Looking for someone to chat with...
                    </h3>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 max-w-sm mx-auto">
                      {interests.length > 0
                        ? `Searching for strangers interested in #${interests.join(", #")}...`
                        : "Matching you randomly with someone online. Hold on tight!"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 font-mono">
                    <span>Press</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold">Esc</kbd>
                    <span>or click Stop to cancel</span>
                  </div>
                </div>
              ) : (
                /* ======================================================= */
                /* LIVE MESSAGE STREAM                                     */
                /* ======================================================= */
                <div className="flex flex-col space-y-2 sm:space-y-3">
                  {messages.map((msg, index) => {
                    const messageKey = `${msg.id || "msg"}-${index}`;
                    if (msg.sender === "system") {
                      return (
                        <div key={messageKey} className="my-0.5 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800/80 border border-gray-200/50 dark:border-white/5 px-2.5 py-0.5 text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 shadow-2xs">
                            <span>ℹ️</span>
                            <span>{msg.text}</span>
                          </span>
                        </div>
                      );
                    }

                    const isYou = msg.sender === "you";
                    return (
                      <div
                        key={messageKey}
                        className={`flex flex-col select-text ${
                          isYou ? "items-end" : "items-start"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-gray-400 mb-0.5 px-1 font-medium select-text">
                          <span>{isYou ? "You" : "Stranger"}</span>
                          <span className="text-[9px] sm:text-[10px] text-gray-400/80">• {msg.time}</span>
                        </div>
                        <div
                          className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs break-words whitespace-pre-wrap select-text ${
                            isYou
                              ? "bg-gradient-to-tr from-orange-400 via-rose-500 to-pink-500 text-white rounded-br-xs"
                              : "bg-gray-100 text-[#18181b] dark:bg-[#201f30] dark:text-gray-100 rounded-bl-xs border border-gray-200/60 dark:border-white/5"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}

                  {/* End of Chat Callout Card */}
                  {chatState === ChatState.ENDED && (
                    <div className="my-2 p-3.5 sm:p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 text-center space-y-2 animate-fade-in">
                      <div className="text-xl sm:text-2xl">👋</div>
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">Stranger has disconnected</h4>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                        Your chat has ended. Click below to meet someone new!
                      </p>
                      <button
                        onClick={handleNext}
                        type="button"
                        className="inline-flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-rose-500/25 transition-all cursor-pointer"
                      >
                        <span>Find New Stranger</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">Esc</kbd>
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Quick Reactions / Icebreakers Bar (Visible when connected) */}
            {chatState === ChatState.CONNECTED && (
              <div className={`flex shrink-0 items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 noSelect scrollbar-none ${isKeyboardOpen ? "hidden md:flex" : ""}`}>
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 shrink-0">Quick Hi:</span>
                {["👋 Hi there!", "😂 Haha", "🔥 Nice!", "Where are you from?", "What's up?"].map((icebreaker) => (
                  <button
                    key={icebreaker}
                    type="button"
                    onClick={() => sendMessage(undefined, icebreaker)}
                    className="shrink-0 rounded-full border border-gray-200/90 dark:border-white/10 bg-white dark:bg-[#161522] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-gray-800 transition-colors cursor-pointer shadow-2xs"
                  >
                    {icebreaker}
                  </button>
                ))}
              </div>
            )}

            {/* =========================================================== */}
            {/* MIDDLE ROW: SMART MATCH & GET PREMIUM PILLS                 */}
            {/* =========================================================== */}
            <div className={`flex items-center gap-1.5 sm:gap-2.5 shrink-0 px-0.5 ${isKeyboardOpen ? "hidden md:flex" : ""}`}>
              {/* Smart Match Pill */}
              <button
                type="button"
                onClick={() => setShowInterestsModal(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full bg-white hover:bg-gray-50 dark:bg-[#181726] dark:hover:bg-[#201e32] border border-gray-200/90 dark:border-white/10 px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors cursor-pointer shadow-2xs"
                id="smart-match-btn"
              >
                <span>🌍</span>
                <span>{interests.length > 0 ? `Smart Match (${interests.length})` : "Smart Match"}</span>
                <span className="text-[10px] text-gray-500">▾</span>
              </button>

              {/* Get Premium Pill */}
              <button
                type="button"
                onClick={() => setShowPremiumModal(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:brightness-105 active:scale-95 px-3 py-1 sm:px-4 sm:py-1.5 text-[11px] sm:text-xs font-bold text-white transition-all cursor-pointer shadow-2xs shadow-orange-500/20"
                id="get-premium-btn"
              >
                <span>⚡</span>
                <span>Get Premium</span>
              </button>
            </div>

            {/* =========================================================== */}
            {/* BOTTOM ACTION ROW: Start/Stop/Next Buttons + Text Input      */}
            {/* =========================================================== */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              
              {/* PRIMARY ACTION BUTTONS (Context-Aware by State) */}
              {chatState === ChatState.IDLE ? (
                <button
                  onClick={startChat}
                  type="button"
                  className="flex h-[44px] sm:h-[54px] w-[62px] sm:w-[95px] shrink-0 flex-col items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-rose-500/25 transition-all cursor-pointer"
                  id="chat-start-btn"
                >
                  <span className="text-xs sm:text-base font-extrabold tracking-wide leading-tight">Start</span>
                  <span className="hidden sm:inline text-[10px] font-medium opacity-85 leading-none mt-0.5 font-mono">Esc</span>
                </button>
              ) : chatState === ChatState.ENDED ? (
                <button
                  onClick={handleNext}
                  type="button"
                  className="flex h-[44px] sm:h-[54px] w-[62px] sm:w-[95px] shrink-0 flex-col items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-rose-500/25 transition-all cursor-pointer"
                  id="chat-new-btn"
                >
                  <span className="text-xs sm:text-base font-extrabold tracking-wide leading-tight">New</span>
                  <span className="hidden sm:inline text-[10px] font-medium opacity-85 leading-none mt-0.5 font-mono">Esc</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Stop Button with Confirmation state */}
                  <button
                    onClick={handleStop}
                    type="button"
                    className={`flex h-[44px] sm:h-[54px] w-[52px] min-[380px]:w-[62px] sm:w-[84px] shrink-0 flex-col items-center justify-center rounded-xl sm:rounded-2xl text-white shadow-sm active:scale-95 transition-all cursor-pointer ${
                      stopConfirm
                        ? "bg-red-600 hover:bg-red-700 animate-pulse"
                        : "bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
                    }`}
                    id="chat-stop-btn"
                  >
                    <span className="text-xs sm:text-sm font-bold leading-tight">
                      {stopConfirm ? "Really?" : "Stop"}
                    </span>
                    <span className="hidden sm:inline text-[10px] opacity-80 leading-none mt-0.5 font-mono">Esc</span>
                  </button>

                  {/* Next Button (Only when connected) */}
                  {chatState === ChatState.CONNECTED && (
                    <button
                      onClick={handleNext}
                      type="button"
                      className="flex h-[44px] sm:h-[54px] w-[52px] min-[380px]:w-[62px] sm:w-[84px] shrink-0 flex-col items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-rose-500/25 transition-all cursor-pointer"
                      id="chat-next-btn"
                    >
                      <span className="text-xs sm:text-sm font-extrabold leading-tight">Next</span>
                      <span className="hidden sm:inline text-[10px] font-medium opacity-85 leading-none mt-0.5 font-mono">Esc</span>
                    </button>
                  )}
                </div>
              )}

              {/* Chat Input Field & Send Button */}
              <form onSubmit={sendMessage} className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  maxLength={500}
                  aria-label="Message stranger"
                  placeholder={
                    chatState === ChatState.CONNECTED
                      ? "Type a message to stranger..."
                      : chatState === ChatState.SEARCHING
                      ? "Waiting for a partner..."
                      : "Click Start to begin chat..."
                  }
                  disabled={chatState !== ChatState.CONNECTED}
                  className="h-[44px] sm:h-[54px] w-full rounded-xl sm:rounded-2xl border border-gray-200/90 bg-white pl-3.5 pr-10 sm:pr-12 text-base placeholder:text-xs sm:placeholder:text-sm text-gray-900 placeholder-gray-400 shadow-2xs outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 disabled:bg-white dark:disabled:bg-[#151421] dark:border-white/10 dark:bg-[#151421] dark:text-gray-100"
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || chatState !== ChatState.CONNECTED}
                  className="absolute right-2 sm:right-3.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-[#f43f5e] transition-colors cursor-pointer disabled:opacity-35"
                  title="Send Message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* =================================================================== */}
      {/* REPORT USER MODAL                                                   */}
      {/* =================================================================== */}
      {showReportModal && (
        <div
          onClick={() => setShowReportModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Report Stranger"
            className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-white/10 dark:bg-[#161522]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Report Stranger
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Help keep V Mingle safe. Why are you reporting this user?
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {[
                { reason: ReportReason.HARASSMENT, label: "Harassment or Bullying" },
                { reason: ReportReason.SEXUAL_CONTENT, label: "Inappropriate Content / Nudity" },
                { reason: ReportReason.SPAM, label: "Spam or Commercial Advertising" },
                { reason: ReportReason.THREATENING, label: "Threats or Violent Behavior" },
                { reason: ReportReason.OTHER, label: "Other Rule Violation" },
              ].map((item) => (
                <label
                  key={item.reason}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-medium transition-colors ${
                    selectedReportReason === item.reason
                      ? "border-rose-400 bg-rose-50 text-[#f43f5e] dark:bg-rose-950/20 dark:text-rose-300"
                      : "border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={item.reason}
                    checked={selectedReportReason === item.reason}
                    onChange={() => setSelectedReportReason(item.reason)}
                    className="accent-[#f43f5e]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={reportSubmitted}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                {reportSubmitted ? "Reported! Skipping..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* INTERESTS MODAL (Inline Interest Editor)                           */}
      {/* =================================================================== */}
      {showInterestsModal && (
        <div
          onClick={() => setShowInterestsModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Chat Interests"
            className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-white/10 dark:bg-[#161522]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏷️</span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Chat Interests
                </h3>
              </div>
              <button
                onClick={() => setShowInterestsModal(false)}
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Add topics you want to talk about. We will prioritize connecting you with people who share these interests.
            </p>

            <form onSubmit={handleAddInterest} className="mt-4 flex gap-2.5">
              <input
                type="text"
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                placeholder="e.g. music, coding, anime"
                className="h-11 flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111019] px-3.5 text-sm text-gray-900 dark:text-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition-all"
              />
              <button
                type="submit"
                className="h-11 rounded-xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 px-4 text-xs font-bold text-white shadow-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                Add Tag
              </button>
            </form>

            {/* Quick Suggestions */}
            <div className="mt-3">
              <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">
                Popular suggestions (click to add):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_MODAL_TAGS.map((tag) => {
                  const isSelected = interests.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleInterest(tag)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-rose-500 text-white font-semibold shadow-xs"
                          : "bg-gray-100 hover:bg-gray-200/80 text-gray-700 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-white/5 pt-3">
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Your tags ({interests.length}/10):
              </div>
              {interests.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllInterests}
                  className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer underline"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1">
              {interests.length > 0 ? (
                interests.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 px-3 py-1 text-xs font-semibold text-[#f43f5e] dark:text-rose-300"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveInterest(tag)}
                      type="button"
                      className="text-rose-400 hover:text-red-500 cursor-pointer font-bold text-xs"
                      title="Remove tag"
                    >
                      ✕
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">No interests added yet. Matching randomly worldwide.</span>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInterestsModal(false)}
                className="rounded-xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PREMIUM MODAL                                                       */}
      {/* =================================================================== */}
      {showPremiumModal && (
        <div
          onClick={() => setShowPremiumModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="V Mingle Premium"
            className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-white/10 dark:bg-[#161522]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white shadow-md shadow-rose-500/25">
                  <span className="text-lg">⚡</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">V Mingle Premium</h3>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unlock supercharged matchmaking</p>
                </div>
              </div>
              <button
                onClick={() => setShowPremiumModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-orange-50/70 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                <span className="text-base">🚀</span>
                <div>
                  <div className="text-xs font-bold text-orange-950 dark:text-orange-200">Zero Wait Queue</div>
                  <div className="text-[11px] text-orange-800/80 dark:text-orange-300/80">Instant priority matching ahead of standard queue.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                <span className="text-base">📹</span>
                <div>
                  <div className="text-xs font-bold text-rose-950 dark:text-rose-200">Crystal Clear HD Video</div>
                  <div className="text-[11px] text-rose-800/80 dark:text-rose-300/80">Stream in 1080p 60fps with optimized WebRTC bitrate.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                <span className="text-base">🎯</span>
                <div>
                  <div className="text-xs font-bold text-amber-950 dark:text-amber-200">Unlimited Smart Match Filters</div>
                  <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80">Filter partners by verified interests and topics.</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
              <span className="text-xs font-semibold text-gray-500">Feature Preview (Coming Soon)</span>
              <button
                type="button"
                onClick={() => setShowPremiumModal(false)}
                className="rounded-xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
