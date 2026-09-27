"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { useInterests } from "@/hooks/useInterests";
import { useHairDetection } from "@/hooks/useHairDetection";
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
  submitReportApi,
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

let msgCounter = 0;
function createUniqueId(prefix = "msg"): string {
  msgCounter += 1;
  return `${prefix}-${Date.now()}-${msgCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

export function ChatRoom({ initialMode = "video", autoStart = true }: ChatRoomProps) {
  const [mode] = useState<"video" | "text">(initialMode);
  const [chatState, setChatState] = useState<ChatState>(
    autoStart ? ChatState.SEARCHING : ChatState.IDLE
  );
  const [stopConfirm, setStopConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (autoStart) {
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

  // Local media controls & status
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<"loading" | "ready" | "denied" | "insecure_context">("loading");
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string>("");

  // Mobile layout switch (PiP vs Split view on small screens)
  const [mobileViewMode, setMobileViewMode] = useState<"pip" | "split">("pip");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Interests
  const [interests, setInterests] = useInterests();
  const [interestInput, setInterestInput] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteMediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<WebRTCOfferPayload | null>(null);
  const currentMatchRef = useRef<MatchInfo | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

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
      console.log(`[ICE] Flushing ${iceCandidateQueueRef.current.length} queued candidates`);
    }
    const candidates = [...iceCandidateQueueRef.current];
    iceCandidateQueueRef.current = [];
    for (const candidateInit of candidates) {
      if (candidateInit && candidateInit.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          console.log("[ICE] Queued candidate applied successfully");
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
    enabled: mode === "video" && cameraStatus === "ready",
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
  }, []);

  // Request camera and microphone if mode is video
  const requestCameraAccess = useCallback(() => {
    if (mode !== "video") return;
    setCameraStatus("loading");
    setCameraErrorMessage("");

    if (typeof window === "undefined") return;

    console.log("[WEBRTC] getUserMedia started");

    // Check for Secure Context requirement (HTTPS or localhost)
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      console.warn("[WEBRTC] getUserMedia failed: Insecure context. WebRTC requires HTTPS or localhost.");
      setCameraStatus("insecure_context");
      setCameraErrorMessage(
        "Camera & microphone access requires HTTPS when accessed from other devices or networks. Please access via HTTPS or a secure tunnel (e.g. Cloudflare / ngrok)."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("[WEBRTC] getUserMedia failed: mediaDevices.getUserMedia not supported on this browser.");
      setCameraStatus("denied");
      setCameraErrorMessage(
        "Your browser does not support camera/microphone access in this context. Please use a modern browser (Chrome, Safari, Firefox, Edge) over HTTPS."
      );
      return;
    }

    const tryGetUserMedia = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: true,
        });
      } catch {
        try {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }
    };

    tryGetUserMedia()
      .then((stream) => {
        console.log("[WEBRTC] getUserMedia success. Active stream:", stream.id);
        localStreamRef.current = stream;
        setCameraStatus("ready");
        setCameraErrorMessage("");
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        // Dynamically attach tracks to active RTCPeerConnection if one is negotiating
        const pc = peerConnectionRef.current;
        if (pc && pc.connectionState !== "closed") {
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
          console.log("[WEBRTC] local tracks added to active peer connection");
        }
      })
      .catch((err: unknown) => {
        console.warn("[WEBRTC] getUserMedia failed:", err);
        setCameraStatus("denied");
        const errorName = err instanceof Error ? err.name : "";
        if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          setCameraErrorMessage(
            "Camera and microphone permission was denied. Please click the camera/lock icon in your browser address bar to allow permissions, then click Retry."
          );
        } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          setCameraErrorMessage("No camera or microphone hardware found on this device.");
        } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
          setCameraErrorMessage("Camera or microphone is already in use by another app (e.g. Zoom, FaceTime). Please close other apps and retry.");
        } else {
          setCameraErrorMessage("Camera access is required for video calls. Please allow camera permission in your browser settings.");
        }
      });
  }, [mode]);

  // Ensure local video element srcObject is bound whenever stream or cameraStatus becomes ready
  useEffect(() => {
    if (cameraStatus === "ready" && localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [cameraStatus]);

  // Ensure remote video element srcObject is bound whenever remote stream becomes active
  useEffect(() => {
    if (remoteStreamActive && remoteVideoRef.current && remoteMediaStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteMediaStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteMediaStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [remoteStreamActive]);

  useEffect(() => {
    const timer = setTimeout(() => {
      requestCameraAccess();
    }, 0);

    return () => {
      clearTimeout(timer);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      cleanupPeerConnection(true);
    };
  }, [requestCameraAccess, cleanupPeerConnection]);

  // Toggle local microphone
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const nextState = !isAudioMuted;
      audioTracks.forEach((track) => {
        track.enabled = isAudioMuted;
      });
      setIsAudioMuted(nextState);
    }
  };

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
      console.log("[WEBRTC] Initializing RTCPeerConnection (isInitiator:", isInitiator, ")");
      const pc = new RTCPeerConnection(pcConfig);
      peerConnectionRef.current = pc;

      // Ensure localStream tracks are attached
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, stream);
          } catch {
            // track already added
          }
        });
        console.log("[WEBRTC] local tracks added to peer connection:", stream.getTracks().map((t) => t.kind));
      } else {
        // Pre-allocate transceivers to ensure SDP negotiation succeeds
        try {
          pc.addTransceiver("video", { direction: "sendrecv" });
          pc.addTransceiver("audio", { direction: "sendrecv" });
          console.log("[WEBRTC] Transceivers pre-allocated (sendrecv)");
        } catch {}
      }

      pc.ontrack = (event) => {
        console.log("[MEDIA] ontrack received:", event.track?.kind, "ID:", event.track?.id);
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
          });
        }
        console.log("[MEDIA] remote stream attached. Total tracks:", remoteStream.getTracks().length);
        setRemoteStreamActive(true);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate) {
          console.log("[SIGNALING] ICE candidate sent:", event.candidate.candidate.substring(0, 48), "...");
          socket.emit(SocketEvents.ICE_CANDIDATE, {
            matchId: currentMatchRef.current?.matchId,
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          } as ICECandidatePayload);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log("[ICE] iceConnectionState changed:", state);
        if (state === "failed") {
          console.warn("[ICE] connection state failed, restarting ICE...");
          if (pc.restartIce) {
            pc.restartIce();
          }
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log("[ICE] iceGatheringState changed:", pc.iceGatheringState);
      };

      pc.onconnectionstatechange = () => {
        console.log("[PEER] connectionState changed:", pc.connectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log("[PEER] signalingState changed:", pc.signalingState);
      };

      // Check if an offer already arrived while peerConnection was being constructed
      if (!isInitiator && pendingOfferRef.current) {
        const pending = pendingOfferRef.current;
        pendingOfferRef.current = null;
        try {
          console.log("[SIGNALING] Applying buffered offer in setupPeerConnection");
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: pending.sdp }));
          await flushIceCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log("[SIGNALING] answer sent to partner (from buffered offer)");
          socket.emit(SocketEvents.WEBRTC_ANSWER, {
            matchId: currentMatchRef.current?.matchId || pending.matchId,
            sdp: answer.sdp || "",
          } as WebRTCAnswerPayload);
        } catch (err) {
          console.error("[WebRTC] Error processing buffered offer in setup:", err);
        }
      } else if (isInitiator) {
        try {
          console.log("[SIGNALING] Creating offer as initiator");
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          console.log("[SIGNALING] offer sent to partner");
          socket.emit(SocketEvents.WEBRTC_OFFER, {
            matchId: currentMatchRef.current?.matchId,
            sdp: offer.sdp || "",
          } as WebRTCOfferPayload);
        } catch (err) {
          console.error("[WebRTC] Error creating offer:", err);
        }
      }
    },
    [mode, cleanupPeerConnection, flushIceCandidates]
  );

  // Start chat - join matchmaking queue
  const startChat = useCallback(() => {
    if (mode === "video" && (!localStreamRef.current || cameraStatus !== "ready")) {
      requestCameraAccess();
    }
    cleanupPeerConnection(true);
    currentMatchRef.current = null;
    setCurrentMatch(null);
    setSharedInterest(null);
    setChatState(ChatState.SEARCHING);
    setStopConfirm(false);

    const socket = connectSocket();

    setMessages([
      {
        id: createUniqueId("sys"),
        sender: "system",
        text:
          interests.length > 0
            ? `Searching for strangers interested in: #${interests.join(", #")}...`
            : "Looking for someone to chat with worldwide...",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    socket.emit(SocketEvents.JOIN_QUEUE, {
      mode,
      interests,
    });
  }, [mode, interests, cameraStatus, requestCameraAccess, cleanupPeerConnection]);

  // Next stranger
  const handleNext = useCallback(() => {
    cleanupPeerConnection(true);
    const socket = connectSocket();
    socket.emit(SocketEvents.NEXT);
    setStopConfirm(false);
    setSharedInterest(null);
    currentMatchRef.current = null;
    setCurrentMatch(null);
    startChat();
  }, [cleanupPeerConnection, startChat]);

  // Stop chat
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
        hasAutoStartedRef.current = true;
        socket.emit(SocketEvents.JOIN_QUEUE, {
          mode,
          interests,
        });
      }
    });

    return () => {
      unmounted = true;
    };
  }, [mode, autoStart, interests]);

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

      const sysText = payload.sharedInterest
        ? `You both like #${payload.sharedInterest}! Say hello to your stranger.`
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
      console.log("[SIGNALING] offer received from partner");
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.log("[SIGNALING] peerConnection not ready yet, queuing incoming offer");
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
        if (localStreamRef.current) {
          const stream = localStreamRef.current;
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
        console.log("[SIGNALING] answer sent to partner");
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
      console.log("[SIGNALING] answer received from partner");
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: payload.sdp })
          );
          await flushIceCandidates(pc);
          console.log("[SIGNALING] Remote answer description set successfully");
        }
      } catch (err) {
        console.error("[WebRTC] Error handling answer:", err);
      }
    };

    const handleICECandidate = async (payload: ICECandidatePayload) => {
      if (mode !== "video") return;
      if (!payload?.candidate) return;
      console.log("[SIGNALING] ICE candidate received:", payload.candidate.substring(0, 48), "...");

      const candidateInit: RTCIceCandidateInit = {
        candidate: payload.candidate,
        sdpMLineIndex: payload.sdpMLineIndex !== undefined ? payload.sdpMLineIndex : null,
        sdpMid: payload.sdpMid !== undefined ? payload.sdpMid : null,
      };
      const pc = peerConnectionRef.current;
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
        console.log("[ICE] Remote description not set yet, queuing candidate");
        iceCandidateQueueRef.current.push(candidateInit);
      } else {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          console.log("[ICE] Candidate applied to peer connection");
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
  }, [mode, cleanupPeerConnection, setupPeerConnection, flushIceCandidates]);

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
  const sendMessage = (e?: React.FormEvent, customText?: string) => {
    e?.preventDefault();
    const text = (customText ?? inputMessage).trim();
    if (!text || chatState !== ChatState.CONNECTED) return;
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
  };

  // Submit report
  const submitReport = async () => {
    setReportSubmitted(true);
    const socket = connectSocket();

    socket.emit(SocketEvents.REPORT_USER, {
      reason: selectedReportReason,
    });

    await submitReportApi({
      reason: selectedReportReason,
      matchId: currentMatch?.matchId,
      reportedUserId: currentMatch?.partnerId,
    });

    setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
      handleNext();
    }, 1000);
  };

  const handleAddInterest = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = interestInput.trim().toLowerCase().replace(/^#/, "");
    if (trimmed && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
      setInterestInput("");
    }
  };

  const handleRemoveInterest = (tag: string) => {
    setInterests(interests.filter((t) => t !== tag));
  };

  return (
    <div className="flex h-screen h-dvh w-full flex-col overflow-hidden bg-[#fdfbf7] dark:bg-[#121016] text-[#111827] dark:text-[#f4f4f7]">
      {/* Universal Header */}
      <Header />

      {/* Main Page Layout Container */}
      <main className="flex-1 min-h-0 min-w-0 w-full flex flex-col px-2.5 sm:px-3.5 lg:px-4 pt-1 pb-2.5 sm:pb-3 overflow-hidden">
        <div className="flex flex-1 min-h-0 min-w-0 w-full flex-col md:flex-row gap-2 sm:gap-2.5 lg:gap-3 overflow-hidden">
          
          {/* ================================================================= */}
          {/* LEFT COLUMN: Dual Video Feeds (Desktop & Mobile Optimized)       */}
          {/* ================================================================= */}
          {mode === "video" && (
            <div className="shrink-0 flex flex-col w-full md:w-[380px] lg:w-[430px] xl:w-[480px] 2xl:w-[520px] md:h-full gap-2 sm:gap-2.5 overflow-hidden">
              
              {/* Mobile View Toggle Bar (Only visible on small screens < md) */}
              <div className="flex md:hidden items-center justify-between px-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${chatState === ChatState.CONNECTED ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                  {chatState === ChatState.CONNECTED ? "Connected" : chatState === ChatState.SEARCHING ? "Searching..." : "Video Preview"}
                </span>

                <div className="flex items-center gap-1 bg-amber-100/70 dark:bg-white/10 rounded-lg p-0.5 text-[11px] font-medium border border-amber-200/50 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setMobileViewMode("pip")}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${mobileViewMode === "pip" ? "bg-white dark:bg-[#1a1827] text-[#f43f5e] dark:text-[#fb7185] font-bold shadow-xs" : "text-gray-600 dark:text-gray-400"}`}
                  >
                    PiP View
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileViewMode("split")}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${mobileViewMode === "split" ? "bg-white dark:bg-[#1a1827] text-[#f43f5e] dark:text-[#fb7185] font-bold shadow-xs" : "text-gray-600 dark:text-gray-400"}`}
                  >
                    Split View
                  </button>
                </div>
              </div>

              {/* Video Feeds Wrapper */}
              <div
                className={`w-full overflow-hidden transition-all ${
                  mobileViewMode === "pip"
                    ? "relative h-[180px] min-[400px]:h-[210px] sm:h-[250px] md:h-full md:flex md:flex-col md:gap-2.5"
                    : "grid grid-cols-2 gap-2 h-[145px] min-[400px]:h-[170px] sm:h-[200px] md:h-full md:flex md:flex-col md:gap-2.5"
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
                      <img
                        src="/favicon.png"
                        alt="V Mingle"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span className="text-xs sm:text-sm font-black text-white tracking-tight drop-shadow-xs">
                      vmingle<span className="font-normal opacity-85">.in</span>
                    </span>
                  </div>

                  {/* TOP-RIGHT CONTROLS: Fullscreen */}
                  <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 flex items-center gap-1.5 z-20">
                    <button
                      onClick={toggleFullscreen}
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-gray-300 hover:text-white hover:bg-black/80 transition-colors cursor-pointer border border-white/10"
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      id="fullscreen-toggle-btn"
                    >
                      {isFullscreen ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* BOTTOM-RIGHT FLAG (Report user): Exact match to reference screenshot */}
                  <button
                    onClick={() => setShowReportModal(true)}
                    type="button"
                    className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 flex h-6 w-6 items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer z-20"
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
                  className={`group overflow-hidden rounded-2xl sm:rounded-3xl border border-gray-200/90 dark:border-white/10 bg-[#12111a] flex items-center justify-center shadow-2xs select-none transition-all ${
                    mobileViewMode === "pip"
                      ? "absolute bottom-2 right-2 w-24 h-32 min-[400px]:w-28 min-[400px]:h-36 sm:w-32 sm:h-40 rounded-xl z-30 shadow-xl ring-2 ring-black/50 md:relative md:bottom-auto md:right-auto md:w-full md:h-auto md:flex-1 md:basis-0 md:min-h-0 md:rounded-2xl sm:md:rounded-3xl md:ring-0"
                      : "relative w-full h-full md:h-auto md:flex-1 md:basis-0 min-h-0 rounded-2xl sm:rounded-3xl"
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

                  {/* Camera Permission State: Insecure Context (HTTP across network/IP) */}
                  {cameraStatus === "insecure_context" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 mb-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <span className="text-[11px] sm:text-xs font-bold text-white mb-1">HTTPS Required for Camera</span>
                      <p className="text-[9px] sm:text-[10px] text-amber-200/90 max-w-[210px] leading-tight mb-2">
                        Browsers block camera &amp; mic over insecure HTTP on other devices. Please connect via HTTPS or a secure tunnel (e.g. Cloudflare / ngrok).
                      </p>
                      <button
                        onClick={requestCameraAccess}
                        type="button"
                        className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-[9px] sm:text-[10px] font-bold text-white cursor-pointer shadow-xs"
                      >
                        Retry Permission
                      </button>
                    </div>
                  )}

                  {/* Camera Permission State: Denied or Not Working */}
                  {cameraStatus === "denied" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15141c]/95 p-3 text-center z-30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 mb-1.5">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                        </svg>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-gray-200 mb-1">Camera Permission Needed</span>
                      <p className="text-[9px] text-gray-400 max-w-[200px] leading-tight mb-2">
                        {cameraErrorMessage || "Camera is required for video calls. Allow camera in your browser settings and click Retry."}
                      </p>
                      <button
                        onClick={requestCameraAccess}
                        type="button"
                        className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-semibold text-white cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Subtle Floating Local Media Controls Toolbar (Always visible on mobile/touch, revealed on hover on desktop: Voice & Flip) */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-1.5 py-0.5 sm:px-2 sm:py-1 border border-white/10 shadow-lg opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-30">
                    {/* Voice Button (Toggle Microphone) */}
                    <button
                      onClick={toggleAudio}
                      type="button"
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors cursor-pointer ${
                        isAudioMuted
                          ? "bg-red-500 text-white"
                          : "text-gray-300 hover:text-white hover:bg-white/20"
                      }`}
                      title="Voice"
                      aria-label="Voice"
                    >
                      {isAudioMuted ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      )}
                    </button>

                    {/* Flip Button */}
                    <button
                      onClick={() => setIsMirrored(!isMirrored)}
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                      title="Flip"
                      aria-label="Flip"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          <div className="flex flex-1 min-w-0 min-h-0 flex-col gap-2.5 sm:gap-3 h-full overflow-hidden">
            
            {/* Main Content Pane (Welcome Rules Card OR Live Chat Messages) */}
            <div className="relative flex-1 min-h-0 overflow-y-auto rounded-2xl sm:rounded-3xl border border-gray-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-2xs dark:border-white/10 dark:bg-[#151421]">
              
              {chatState === ChatState.IDLE ? (
                /* ======================================================= */
                /* WELCOME & RULES HERO CARD - EXACT MATCH TO REFERENCE    */
                /* ======================================================= */
                <div className="flex flex-col h-full justify-between select-none">
                  <div>
                    {/* Header */}
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                      Welcome to V Mingle.
                    </h2>

                    {/* Guidelines List */}
                    <div className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3 text-base sm:text-lg">
                      {/* Age restriction line */}
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center bg-[#ff3b30] text-white text-xs font-black px-1.5 py-0.5 rounded shadow-2xs">
                          18+
                        </span>
                        <span className="text-[#f43f5e] dark:text-[#fb7185] font-bold text-base sm:text-lg">
                          You must be 18 or older
                        </span>
                      </div>

                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        No nudity, hate speech, or harassment
                      </p>

                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        Your camera must show you, live
                      </p>

                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        Do not ask for gender — this is not a dating site
                      </p>

                      <p className="font-extrabold text-gray-900 dark:text-white">
                        Violators will be banned
                      </p>
                    </div>
                  </div>
                </div>
              ) : chatState === ChatState.SEARCHING && messages.filter((m) => m.sender !== "system").length === 0 ? (
                /* ======================================================= */
                /* HIGH-TECH MATCHMAKING RADAR STATE                       */
                /* ======================================================= */
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
                  <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24">
                    <div className="absolute inset-0 rounded-full bg-rose-500/15 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-orange-500/25 animate-pulse" />
                    <div className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white shadow-xl shadow-rose-500/30">
                      <svg className="animate-spin h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                      Looking for someone to chat with...
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                      {interests.length > 0
                        ? `Searching for strangers interested in #${interests.join(", #")}...`
                        : "Matching you randomly with someone online. Hold on tight!"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 font-mono">
                    <span>Press</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold">Esc</kbd>
                    <span>or click Stop to cancel</span>
                  </div>
                </div>
              ) : (
                /* ======================================================= */
                /* LIVE MESSAGE STREAM                                     */
                /* ======================================================= */
                <div className="flex flex-col space-y-2.5 sm:space-y-3">
                  {messages.map((msg, index) => {
                    const messageKey = `${msg.id || "msg"}-${index}`;
                    if (msg.sender === "system") {
                      return (
                        <div key={messageKey} className="my-1 text-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800/80 border border-gray-200/50 dark:border-white/5 px-3 py-1 text-xs text-gray-600 dark:text-gray-300 shadow-2xs">
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
                        className={`flex flex-col ${
                          isYou ? "items-end" : "items-start"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-0.5 px-1 font-medium">
                          <span>{isYou ? "You" : "Stranger"}</span>
                          <span className="text-[10px] text-gray-400/80">• {msg.time}</span>
                        </div>
                        <div
                          className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs break-words ${
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
                    <div className="my-4 p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 text-center space-y-2.5 animate-fade-in">
                      <div className="text-2xl">👋</div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">Stranger has disconnected</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                        Your chat has ended. Click below to meet someone new!
                      </p>
                      <button
                        onClick={handleNext}
                        type="button"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-rose-500/25 transition-all cursor-pointer"
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
              <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto py-0.5 noSelect">
                <span className="text-[11px] font-semibold text-gray-400 shrink-0">Quick Hi:</span>
                {["👋 Hi there!", "😂 Haha", "🔥 Nice!", "Where are you from?", "What's up?"].map((icebreaker) => (
                  <button
                    key={icebreaker}
                    type="button"
                    onClick={() => sendMessage(undefined, icebreaker)}
                    className="shrink-0 rounded-full border border-gray-200/90 dark:border-white/10 bg-white dark:bg-[#161522] px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-gray-800 transition-colors cursor-pointer shadow-2xs"
                  >
                    {icebreaker}
                  </button>
                ))}
              </div>
            )}

            {/* =========================================================== */}
            {/* MIDDLE ROW: SMART MATCH & GET PREMIUM PILLS                 */}
            {/* =========================================================== */}
            <div className="flex items-center gap-2.5 shrink-0 px-0.5">
              {/* Smart Match Pill */}
              <button
                type="button"
                onClick={() => setShowInterestsModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white hover:bg-gray-50 dark:bg-[#181726] dark:hover:bg-[#201e32] border border-gray-200/90 dark:border-white/10 px-3.5 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors cursor-pointer shadow-2xs"
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
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:brightness-105 active:scale-95 px-4 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-2xs shadow-orange-500/20"
                id="get-premium-btn"
              >
                <span>⚡</span>
                <span>Get Premium</span>
              </button>
            </div>

            {/* =========================================================== */}
            {/* BOTTOM ACTION ROW: Start/Stop/Next Buttons + Text Input      */}
            {/* =========================================================== */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              
              {/* PRIMARY ACTION BUTTONS (Context-Aware by State) */}
              {chatState === ChatState.IDLE ? (
                <button
                  onClick={startChat}
                  type="button"
                  className="flex h-[48px] sm:h-[56px] w-[70px] sm:w-[95px] shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-rose-500/25 transition-all cursor-pointer"
                  id="chat-start-btn"
                >
                  <span className="text-sm sm:text-base font-extrabold tracking-wide leading-tight">Start</span>
                  <span className="hidden sm:inline text-[10px] font-medium opacity-85 leading-none mt-0.5 font-mono">Esc</span>
                </button>
              ) : chatState === ChatState.ENDED ? (
                <button
                  onClick={handleNext}
                  type="button"
                  className="flex h-[48px] sm:h-[56px] w-[70px] sm:w-[95px] shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-rose-500/25 transition-all cursor-pointer"
                  id="chat-new-btn"
                >
                  <span className="text-sm sm:text-base font-extrabold tracking-wide leading-tight">New</span>
                  <span className="hidden sm:inline text-[10px] font-medium opacity-85 leading-none mt-0.5 font-mono">Esc</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Stop Button with Confirmation state */}
                  <button
                    onClick={handleStop}
                    type="button"
                    className={`flex h-[48px] sm:h-[56px] w-[56px] min-[380px]:w-[68px] sm:w-[84px] shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-sm active:scale-95 transition-all cursor-pointer ${
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
                      className="flex h-[48px] sm:h-[56px] w-[56px] min-[380px]:w-[68px] sm:w-[84px] shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-rose-500/25 transition-all cursor-pointer"
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
                      : ""
                  }
                  disabled={chatState !== ChatState.CONNECTED}
                  className="h-[52px] sm:h-[56px] w-full rounded-2xl border border-gray-200/90 bg-white pl-4 pr-12 text-sm sm:text-base text-gray-900 placeholder-gray-400 shadow-2xs outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 disabled:bg-white dark:disabled:bg-[#151421] dark:border-white/10 dark:bg-[#151421] dark:text-gray-100"
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || chatState !== ChatState.CONNECTED}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-[#f43f5e] transition-colors cursor-pointer disabled:opacity-35"
                  title="Send Message"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
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
            className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#161522]"
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
            className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#161522]"
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

            <div className="mt-4 flex flex-wrap gap-2 max-h-40 overflow-y-auto pt-1">
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
                <span className="text-xs text-gray-400 italic">No interests added yet.</span>
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
            className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#161522]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-white shadow-md shadow-rose-500/25">
                  <span className="text-lg">⚡</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">V Mingle Premium</h3>
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
              <span className="text-xs font-semibold text-gray-500">Free preview available</span>
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
