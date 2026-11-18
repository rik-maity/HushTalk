
import { useEffect, useRef } from "react";

import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Camera,
  CameraOff
} from "lucide-react";

function getConnectionLabel(state) {
  switch (state) {
    case "connected":
      return "Connected";

    case "connecting":
    case "checking":
      return "Connecting media…";

    case "disconnected":
      return "Connection interrupted…";

    case "failed":
      return "Connection failed";

    case "closed":
      return "Call ended";

    default:
      return "Preparing media…";
  }
}

export default function CallDialog({
  call,
  participantName,
  onAccept,
  onReject,
  onEnd,

  localStream,
  remoteStream,

  connectionState = "new",
  mediaError = "",

  isMuted = false,
  isCameraOn = true,

  onToggleMute,
  onToggleCamera
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const isVideo = call?.callType === "VIDEO";

  // -----------------------------------------
  // Attach local camera preview
  // -----------------------------------------

  useEffect(() => {
    const video = localVideoRef.current;

    if (!video) return;

    video.srcObject = localStream || null;

    if (localStream) {
      video.play().catch(() => {});
    }

    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [localStream, call?.callType, call?.status]);

  // -----------------------------------------
  // Attach remote video
  // -----------------------------------------

  useEffect(() => {
    const video = remoteVideoRef.current;

    if (!video) return;

    video.srcObject = remoteStream || null;

    if (remoteStream) {
      video.play().catch(() => {});
    }

    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [remoteStream, call?.callType, call?.status,isCameraOn]);

  // -----------------------------------------
  // Attach remote audio for audio-only calls
  // -----------------------------------------

  useEffect(() => {
    const audio = remoteAudioRef.current;

    if (!audio) return;

    audio.srcObject = !isVideo
      ? remoteStream || null
      : null;

    if (!isVideo && remoteStream) {
      audio.play().catch(() => {});
    }

    return () => {
      if (audio) {
        audio.srcObject = null;
      }
    };
  }, [remoteStream, isVideo, call?.status]);

  if (!call) return null;

  const isIncoming = call.direction === "INCOMING";
  const isRinging = call.status === "RINGING";
  const isAccepted = call.status === "ACCEPTED";

  // -----------------------------------------
  // Incoming / outgoing ringing UI
  // -----------------------------------------

  if (!isAccepted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">

          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-brand">
            {isVideo ? (
              <Video size={32} />
            ) : (
              <Phone size={32} />
            )}
          </div>

          <div className="mt-5 text-center">
            <h2 className="text-xl font-bold text-ink">
              {participantName}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {isIncoming && isRinging &&
                `Incoming ${isVideo ? "video" : "audio"} call`}

              {!isIncoming && isRinging &&
                `Calling ${participantName}…`}

              {call.status === "STARTING" &&
                "Starting call…"}
            </p>

            <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {call.callType} CALL
            </div>
          </div>

          {mediaError && (
            <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">
              {mediaError}
            </p>
          )}

          <div className="mt-7 flex items-center justify-center gap-4">

            {isIncoming && isRinging && (
              <>
                <button
                  type="button"
                  onClick={onReject}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-100"
                >
                  <PhoneOff size={17} />
                  Decline
                </button>

                <button
                  type="button"
                  onClick={onAccept}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  <Phone size={17} />
                  Accept
                </button>
              </>
            )}

            {!isIncoming && isRinging && (
              <button
                type="button"
                onClick={onEnd}
                className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-600"
              >
                <PhoneOff size={17} />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------
  // Accepted video call UI
  // -----------------------------------------

  if (isVideo) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">

        {/* Remote participant video */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-900">

          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-800 text-slate-400">
                <Video size={36} />
              </div>

              <p className="text-sm text-slate-300">
                Waiting for {participantName}'s video…
              </p>

              <p className="text-xs text-slate-500">
                {getConnectionLabel(connectionState)}
              </p>
            </div>
          )}

          {/* Top information */}
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-5 py-5">
            <div>
              <h2 className="font-semibold">
                {participantName}
              </h2>

              <p className="mt-1 text-xs text-slate-300">
                {getConnectionLabel(connectionState)}
              </p>
            </div>

            <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white">
              VIDEO CALL
            </span>
          </div>

          {/* Local camera preview */}
          <div className="absolute right-4 top-20 h-32 w-24 overflow-hidden rounded-2xl border border-white/20 bg-slate-800 shadow-xl sm:right-6 sm:h-44 sm:w-36">
            {localStream?.getVideoTracks().length > 0 && isCameraOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                <CameraOff size={22} />
                <span className="text-[10px]">Camera off</span>
              </div>
            )}

            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-[10px]">
              You
            </span>
          </div>

          {/* Media error */}
          {mediaError && (
            <div className="absolute bottom-5 left-4 right-4 rounded-xl border border-rose-400/30 bg-rose-950/90 px-4 py-3 text-center text-xs text-rose-100">
              {mediaError}
            </div>
          )}
        </div>

        {/* Video call controls */}
        <div className="flex items-center justify-center gap-4 bg-slate-950 px-4 py-6">

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={
              isMuted ? "Unmute microphone" : "Mute microphone"
            }
            className={`grid h-14 w-14 place-items-center rounded-full transition ${
              isMuted
                ? "bg-white text-slate-900"
                : "bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            {isMuted ? (
              <MicOff size={21} />
            ) : (
              <Mic size={21} />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCamera}
            disabled={!localStream?.getVideoTracks().length}
            aria-label={
              isCameraOn ? "Turn camera off" : "Turn camera on"
            }
            className={`grid h-14 w-14 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
              !isCameraOn
                ? "bg-white text-slate-900"
                : "bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            {isCameraOn ? (
              <Video size={21} />
            ) : (
              <VideoOff size={21} />
            )}
          </button>

          <button
            type="button"
            onClick={onEnd}
            aria-label="End call"
            className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------
  // Accepted audio call UI
  // -----------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">

      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
      />

      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-ink shadow-2xl">

        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-brand">
          <Phone size={32} />
        </div>

        <div className="mt-5 text-center">
          <h2 className="text-xl font-bold">
            {participantName}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {getConnectionLabel(connectionState)}
          </p>

          <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            AUDIO CALL
          </span>
        </div>

        {mediaError && (
          <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">
            {mediaError}
          </p>
        )}

        <div className="mt-7 flex items-center justify-center gap-4">

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={
              isMuted ? "Unmute microphone" : "Mute microphone"
            }
            className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            {isMuted ? (
              <MicOff size={19} />
            ) : (
              <Mic size={19} />
            )}
          </button>

          <button
            type="button"
            onClick={onEnd}
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-600"
          >
            <PhoneOff size={17} />
            End call
          </button>
        </div>
      </div>
    </div>
  );
}
