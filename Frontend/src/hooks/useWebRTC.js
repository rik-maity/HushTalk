
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" }
];

export default function useWebRTC({
  call,
  sendOffer,
  sendAnswer,
  sendIceCandidate
}) {
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const localMediaPromiseRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const callIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const offerStartedRef = useRef(new Set());
  const mountedRef = useRef(true);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [connectionState, setConnectionState] = useState("new");
  const [mediaError, setMediaError] = useState("");

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);

  // -----------------------------------------
  // Close peer connection and stop all tracks
  // -----------------------------------------

  const closePeerConnection = useCallback(() => {
    const pc = peerConnectionRef.current;

    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;

      pc.close();
    }

    peerConnectionRef.current = null;
    pendingCandidatesRef.current = [];

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());
    }

    localStreamRef.current = null;
    localMediaPromiseRef.current = null;
    remoteStreamRef.current = null;

    if (mountedRef.current) {
      setLocalStream(null);
      setRemoteStream(null);
      setConnectionState("new");
      setIsMuted(false);
      setIsCameraOn(true);
    }
  }, []);

  // -----------------------------------------
  // Create RTCPeerConnection
  // -----------------------------------------

  const ensurePeerConnection = useCallback(
    (callId) => {
      if (
        peerConnectionRef.current &&
        callIdRef.current === callId
      ) {
        return peerConnectionRef.current;
      }

      if (peerConnectionRef.current) {
        closePeerConnection();
      }

      callIdRef.current = callId;

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS
      });

      // Send local ICE candidates through STOMP.
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;

        if (callIdRef.current !== callId) return;

        try {
          sendIceCandidate(
            callId,
            event.candidate
          );
        } catch (error) {
          console.error(
            "Could not send ICE candidate:",
            error
          );
        }
      };

      // Receive remote audio/video tracks.
      pc.ontrack = (event) => {
        if (callIdRef.current !== callId) return;

        let stream = event.streams?.[0];

        if (!stream) {
          stream =
            remoteStreamRef.current ||
            new MediaStream();

          const alreadyAdded = stream
            .getTracks()
            .some((track) => track.id === event.track.id);

          if (!alreadyAdded) {
            stream.addTrack(event.track);
          }
        }

        remoteStreamRef.current = stream;

        if (mountedRef.current) {
          setRemoteStream(stream);
        }
      };

      pc.onconnectionstatechange = () => {
        if (callIdRef.current !== callId) return;
        if (!mountedRef.current) return;

        setConnectionState(pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        if (callIdRef.current !== callId) return;
        if (!mountedRef.current) return;

        if (
          pc.connectionState === "new" &&
          pc.iceConnectionState !== "new"
        ) {
          setConnectionState(pc.iceConnectionState);
        }
      };

      peerConnectionRef.current = pc;

      return pc;
    },
    [closePeerConnection, sendIceCandidate]
  );

  // -----------------------------------------
  // Request microphone and optional camera
  // -----------------------------------------

  const ensureLocalMedia = useCallback(
    async (callId, callType) => {
      if (
        localStreamRef.current &&
        callIdRef.current === callId
      ) {
        return localStreamRef.current;
      }

      // Share a pending permission request.
      if (localMediaPromiseRef.current) {
        return localMediaPromiseRef.current;
      }

      const isVideoCall =
        String(callType).toUpperCase() === "VIDEO";

      const mediaPromise = (async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Camera and microphone access is unavailable. Use HTTPS or localhost with a supported browser."
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: isVideoCall
              ? {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  frameRate: { ideal: 30, max: 30 }
                }
              : false
          });

        // The call might have ended while the browser
        // was showing its permission prompt.
        if (callIdRef.current !== callId) {
          stream
            .getTracks()
            .forEach((track) => track.stop());

          throw new Error(
            "The call ended before media access was ready."
          );
        }

        localStreamRef.current = stream;

        if (mountedRef.current) {
          setLocalStream(stream);
        }

        const pc = ensurePeerConnection(callId);

        stream.getTracks().forEach((track) => {
          const alreadyAdded = pc
            .getSenders()
            .some(
              (sender) => sender.track?.id === track.id
            );

          if (!alreadyAdded) {
            pc.addTrack(track, stream);
          }
        });

        return stream;
      })();

      localMediaPromiseRef.current = mediaPromise;

      try {
        return await mediaPromise;
      } finally {
        if (
          localMediaPromiseRef.current === mediaPromise
        ) {
          localMediaPromiseRef.current = null;
        }
      }
    },
    [ensurePeerConnection]
  );

  // -----------------------------------------
  // Apply ICE candidates received early
  // -----------------------------------------

  const flushPendingCandidates = useCallback(
    async (pc) => {
      if (!pc.remoteDescription) return;

      const queued = pendingCandidatesRef.current;

      pendingCandidatesRef.current = [];

      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error(
            "Could not apply queued ICE candidate:",
            error
          );
        }
      }
    },
    []
  );

  // -----------------------------------------
  // Handle remote signaling events
  // -----------------------------------------

  const handleSignalEvent = useCallback(
    async (event) => {
      const callId = event?.callId;

      if (!callId || callId !== callIdRef.current) {
        return;
      }

      try {
        // -------------------------------------
        // CALLEE receives SDP offer
        // -------------------------------------

        if (event.eventType === "WEBRTC_OFFER") {
          await ensureLocalMedia(
            callId,
            call?.callType
          );

          const pc = ensurePeerConnection(callId);

          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: "offer",
              sdp: event.sdp
            })
          );

          await flushPendingCandidates(pc);

          const answer = await pc.createAnswer();

          await pc.setLocalDescription(answer);

          sendAnswer(
            callId,
            pc.localDescription.sdp
          );

          return;
        }

        // -------------------------------------
        // CALLER receives SDP answer
        // -------------------------------------

        if (event.eventType === "WEBRTC_ANSWER") {
          const pc = peerConnectionRef.current;

          if (!pc) {
            throw new Error(
              "Received an answer before the peer connection was ready."
            );
          }

          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: "answer",
              sdp: event.sdp
            })
          );

          await flushPendingCandidates(pc);

          return;
        }

        // -------------------------------------
        // Both sides receive ICE candidates
        // -------------------------------------

        if (event.eventType === "ICE_CANDIDATE") {
          const candidate = {
            candidate: event.candidate,
            sdpMid: event.sdpMid,
            sdpMLineIndex: event.sdpMLineIndex
          };

          const pc = peerConnectionRef.current;

          if (!pc || !pc.remoteDescription) {
            pendingCandidatesRef.current.push(candidate);
            return;
          }

          await pc.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (error) {
        console.error(
          "WebRTC signaling failed:",
          error
        );

        if (mountedRef.current) {
          setMediaError(
            error?.message ||
              "Could not establish the media connection."
          );
        }
      }
    },
    [
      call?.callType,
      ensureLocalMedia,
      ensurePeerConnection,
      flushPendingCandidates,
      sendAnswer
    ]
  );

  // -----------------------------------------
  // Reset media when call ID changes
  // -----------------------------------------

  useEffect(() => {
    const nextCallId = call?.callId || null;

    if (callIdRef.current !== nextCallId) {
      const previousCallId = callIdRef.current;

      closePeerConnection();

      if (previousCallId) {
        offerStartedRef.current.delete(previousCallId);
      }

      callIdRef.current = nextCallId;

      setMediaError("");
      setConnectionState("new");
    }
  }, [call?.callId, closePeerConnection]);

  // -----------------------------------------
  // Prepare accepted call
  // -----------------------------------------

  useEffect(() => {
    if (
      !call?.callId ||
      call.status !== "ACCEPTED"
    ) {
      return undefined;
    }

    let cancelled = false;

    async function prepareCall() {
      try {
        await ensureLocalMedia(
          call.callId,
          call.callType
        );

        if (cancelled) return;

        // Only the caller creates the initial offer.
        // The callee waits for WEBRTC_OFFER.
        if (
          call.direction === "OUTGOING" &&
          !offerStartedRef.current.has(call.callId)
        ) {
          offerStartedRef.current.add(call.callId);

          const pc = ensurePeerConnection(call.callId);

          const offer = await pc.createOffer();

          await pc.setLocalDescription(offer);

          if (
            !cancelled &&
            callIdRef.current === call.callId
          ) {
            sendOffer(
              call.callId,
              pc.localDescription.sdp
            );
          }
        }
      } catch (error) {
        console.error(
          "Could not prepare call media:",
          error
        );

        if (!cancelled && mountedRef.current) {
          setMediaError(
            error?.message ||
              "Could not access your microphone or camera."
          );
        }
      }
    }

    prepareCall();

    return () => {
      cancelled = true;
    };
  }, [
    call?.callId,
    call?.status,
    call?.direction,
    call?.callType,
    ensureLocalMedia,
    ensurePeerConnection,
    sendOffer
  ]);

  // -----------------------------------------
  // Stop media on unmount
  // -----------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      localStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      peerConnectionRef.current = null;
      localStreamRef.current = null;
      localMediaPromiseRef.current = null;
      remoteStreamRef.current = null;
    };
  }, []);

  // -----------------------------------------
  // Microphone toggle
  // -----------------------------------------

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const nextMuted = !isMuted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
  }, [isMuted]);

  // -----------------------------------------
  // Camera toggle
  // -----------------------------------------

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const videoTracks = stream.getVideoTracks();

    if (videoTracks.length === 0) return;

    const nextCameraOn = !isCameraOn;

    videoTracks.forEach((track) => {
      track.enabled = nextCameraOn;
    });

    setIsCameraOn(nextCameraOn);
  }, [isCameraOn]);

  return {
    localStream,
    remoteStream,
    connectionState,
    mediaError,
    isMuted,
    isCameraOn,
    toggleMute,
    toggleCamera,
    handleSignalEvent
  };
}
