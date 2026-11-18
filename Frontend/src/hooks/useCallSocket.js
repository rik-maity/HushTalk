
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import { Client } from "@stomp/stompjs";

import {
  WS_URL,
  refreshAccessToken
} from "../api/client";

/**
 * Global authenticated STOMP connection for call signaling.
 * Kept separate from useConversationSocket so incoming calls
 * work even when no conversation is selected.
 */
export function useCallSocket({ accessToken, onCallEvent }) {
  const clientRef = useRef(null);
  const eventHandlerRef = useRef(onCallEvent);
  const refreshAttemptRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState("");

  // Keep the latest event handler without reconnecting the socket.
  useEffect(() => {
    eventHandlerRef.current = onCallEvent;
  }, [onCallEvent]);

  // Establish the authenticated signaling connection.
  useEffect(() => {
    if (!accessToken) {
      setConnected(false);
      setSocketError("");
      return undefined;
    }

    let active = true;

    const client = new Client({
      brokerURL: WS_URL,

      connectHeaders: {
        Authorization: `Bearer ${accessToken}`
      },

      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        if (!active) return;

        setConnected(true);
        setSocketError("");
        refreshAttemptRef.current = null;

        client.subscribe("/user/queue/calls", (frame) => {
          try {
            const event = JSON.parse(frame.body);
            eventHandlerRef.current?.(event);
          } catch (error) {
            console.error(
              "Could not parse call signaling event:",
              error
            );

            setSocketError(
              "Could not read an incoming call event."
            );
          }
        });
      },

      onDisconnect: () => {
        if (active) {
          setConnected(false);
        }
      },

      onWebSocketClose: () => {
        if (active) {
          setConnected(false);
        }
      },

      onStompError: (frame) => {
        if (!active) return;

        setConnected(false);

        const description =
          frame.headers?.message ||
          frame.body ||
          "The call signaling broker rejected the connection.";

        setSocketError(description);

        if (
          /jwt|token|expired|unauthorized|authentication/i.test(
            description
          ) &&
          refreshAttemptRef.current !== accessToken
        ) {
          refreshAttemptRef.current = accessToken;

          refreshAccessToken().catch(() => {
            // AuthContext handles auth expiration.
          });
        }
      },

      onWebSocketError: () => {
        if (!active) return;

        setConnected(false);
        setSocketError(
          "Could not connect to the call signaling server."
        );
      }
    });

    clientRef.current = client;
    client.activate();

    return () => {
      active = false;

      if (clientRef.current === client) {
        clientRef.current = null;
      }

      setConnected(false);
      void client.deactivate();
    };
  }, [accessToken]);

  // Common publishing function.
  const publish = useCallback((destination, payload) => {
    const client = clientRef.current;

    if (!client?.connected) {
      throw new Error("Call signaling is not connected.");
    }

    client.publish({
      destination,
      headers: {
        "content-type": "application/json"
      },
      body: payload == null ? "" : JSON.stringify(payload)
    });
  }, []);

  // Initiate a call.
  const initiateCall = useCallback(
    (conversationId, targetUserId, callType) => {
      publish("/app/calls/initiate", {
        conversationId,
        targetUserId,
        callType: String(callType).toUpperCase()
      });
    },
    [publish]
  );

  // Accept an incoming call.
  const acceptCall = useCallback(
    (callId) => {
      publish(`/app/calls/${callId}/accept`);
    },
    [publish]
  );

  // Reject an incoming call.
  const rejectCall = useCallback(
    (callId) => {
      publish(`/app/calls/${callId}/reject`);
    },
    [publish]
  );

  // End an active call.
  const endCall = useCallback(
    (callId) => {
      publish(`/app/calls/${callId}/end`);
    },
    [publish]
  );

  // Send WebRTC SDP offer.
  const sendOffer = useCallback(
    (callId, sdp) => {
      publish(`/app/calls/${callId}/offer`, { sdp });
    },
    [publish]
  );

  // Send WebRTC SDP answer.
  const sendAnswer = useCallback(
    (callId, sdp) => {
      publish(`/app/calls/${callId}/answer`, { sdp });
    },
    [publish]
  );

  // Send ICE candidate.
  const sendIceCandidate = useCallback(
    (callId, candidate) => {
      publish(`/app/calls/${callId}/ice`, {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex
      });
    },
    [publish]
  );

  return {
    connected,
    socketError,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate
  };
}

export default useCallSocket;
