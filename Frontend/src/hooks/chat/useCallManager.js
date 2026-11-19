import { useCallback, useEffect, useRef, useState } from "react";
import { fetchConversationMembers } from "../../api/chatApi";
import { getErrorMessage } from "../../api/client";
import { useCallSocket } from "../useCallSocket";
import useWebRTC from "../useWebRTC";

export default function useCallManager({ accessToken, selected, currentUserId }) {
  const [conversationPeer, setConversationPeer] = useState(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [callStarting, setCallStarting] = useState(false);
  const [callError, setCallError] = useState("");
  const [callNotice, setCallNotice] = useState("");
  const webRTCRef = useRef(null);

  const handleCallEvent = useCallback((event) => {
    if (!event?.eventType) return;
    setCallError("");
    switch (event.eventType) {
      case "INCOMING_CALL":
        setCallStarting(false);
        setCallNotice("");
        setActiveCall({ ...event, direction: "INCOMING" });
        break;
      case "CALL_RINGING":
        setCallStarting(false);
        setCallNotice("");
        setActiveCall({ ...event, direction: "OUTGOING" });
        break;
      case "CALL_ACCEPTED":
        setCallStarting(false);
        setActiveCall((current) => current?.callId === event.callId
          ? { ...current, status: "ACCEPTED" }
          : current);
        break;
      case "CALL_REJECTED":
        setCallStarting(false);
        setCallNotice("The other participant declined the call.");
        setActiveCall((current) => current?.callId === event.callId ? null : current);
        break;
      case "CALL_ENDED":
        setCallStarting(false);
        setCallNotice("The call has ended.");
        setActiveCall((current) => current?.callId === event.callId ? null : current);
        break;
      case "WEBRTC_OFFER":
      case "WEBRTC_ANSWER":
      case "ICE_CANDIDATE":
        void webRTCRef.current?.handleSignalEvent(event);
        break;
      default:
        console.warn("Unknown call signaling event:", event.eventType);
    }
  }, []);

  const {
    connected: callConnected,
    socketError: callSocketError,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate
  } = useCallSocket({ accessToken, onCallEvent: handleCallEvent });

  const webRTC = useWebRTC({
    call: activeCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate
  });
  webRTCRef.current = webRTC;

  useEffect(() => {
    let active = true;
    setConversationPeer(null);
    setMembersLoading(false);
    if (!selected?.id) return undefined;
    setMembersLoading(true);

    async function loadConversationPeer() {
      try {
        const members = await fetchConversationMembers(selected.id);
        if (!active) return;
        if (!Array.isArray(members) || members.length !== 2) {
          setConversationPeer(null);
          return;
        }
        const peer = members.find((member) => {
          const id = member.id ?? member.userId ?? member.user?.id;
          return Number(id) !== Number(currentUserId);
        });
        if (!peer) {
          setConversationPeer(null);
          return;
        }
        const peerId = peer.id ?? peer.userId ?? peer.user?.id;
        setConversationPeer({
          ...peer,
          id: peerId,
          username: peer.username ?? peer.user?.username ?? `User ${peerId}`
        });
      } catch (error) {
        if (active) {
          setConversationPeer(null);
          setCallError(`Could not load conversation members: ${getErrorMessage(error)}`);
        }
      } finally {
        if (active) setMembersLoading(false);
      }
    }
    void loadConversationPeer();
    return () => { active = false; };
  }, [selected?.id, currentUserId]);

  const handleStartCall = useCallback((callType) => {
    if (!selected || !conversationPeer || !callConnected || activeCall || callStarting) return;
    const normalizedCallType = String(callType).toUpperCase();
    if (!["AUDIO", "VIDEO"].includes(normalizedCallType)) {
      setCallError("Unsupported call type.");
      return;
    }
    setCallError("");
    setCallNotice("");
    setCallStarting(true);
    try {
      initiateCall(selected.id, conversationPeer.id, normalizedCallType);
    } catch (error) {
      setCallStarting(false);
      setCallError(getErrorMessage(error));
    }
  }, [selected, conversationPeer, callConnected, activeCall, callStarting, initiateCall]);

  const handleAcceptCall = useCallback(() => {
    if (!activeCall?.callId) return;
    setCallError("");
    try {
      acceptCall(activeCall.callId);
      setActiveCall((current) => current?.callId === activeCall.callId
        ? { ...current, status: "ACCEPTED" }
        : current);
    } catch (error) {
      setCallError(getErrorMessage(error));
    }
  }, [activeCall, acceptCall]);

  const handleRejectCall = useCallback(() => {
    if (!activeCall?.callId) return;
    setCallError("");
    try {
      rejectCall(activeCall.callId);
      setActiveCall(null);
      setCallNotice("Call declined.");
    } catch (error) {
      setCallError(getErrorMessage(error));
    }
  }, [activeCall, rejectCall]);

  const handleEndCall = useCallback(() => {
    if (!activeCall?.callId) return;
    setCallError("");
    try {
      endCall(activeCall.callId);
      setActiveCall(null);
      setCallNotice("Call ended.");
    } catch (error) {
      setCallError(getErrorMessage(error));
    }
  }, [activeCall, endCall]);

  const canCall = Boolean(
    selected && conversationPeer && callConnected && !activeCall && !callStarting
  );
  const callDisabledReason = membersLoading
    ? "Loading conversation members"
    : !conversationPeer
      ? "Calls currently support one-to-one conversations only"
      : !callConnected
        ? "Call signaling is disconnected"
        : activeCall || callStarting
          ? "You already have an active call"
          : "Start a call";

  return {
    conversationPeer,
    membersLoading,
    activeCall,
    callStarting,
    callError,
    callNotice,
    callConnected,
    callSocketError,
    webRTC,
    canCall,
    callDisabledReason,
    handleStartCall,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall
  };
}
