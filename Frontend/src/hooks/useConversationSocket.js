
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

export default function useConversationSocket({
  accessToken,
  conversationId,
  onMessage,
  onTyping,
  onReceipt,
  onReaction
}) {
  const clientRef = useRef(null);

  const handlersRef = useRef({});

  const refreshAttemptRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState("");

  useEffect(() => {
    handlersRef.current = {
      onMessage,
      onTyping,
      onReceipt,
      onReaction
    };
  }, [
    onMessage,
    onTyping,
    onReceipt,
    onReaction
  ]);

  useEffect(() => {
    if (!accessToken || !conversationId) {
      setConnected(false);
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

        // Message channel
        client.subscribe(
          `/topic/conversations/${conversationId}`,
          (frame) => {
            try {
              handlersRef.current.onMessage?.(
                JSON.parse(frame.body)
              );
            } catch {
              setSocketError(
                "Could not read incoming message."
              );
            }
          }
        );

        // Typing channel
        client.subscribe(
          `/topic/conversations/${conversationId}/typing`,
          (frame) => {
            try {
              handlersRef.current.onTyping?.(
                JSON.parse(frame.body)
              );
            } catch {
              setSocketError(
                "Could not read typing event."
              );
            }
          }
        );

        // Receipt channel
        client.subscribe(
          `/topic/conversations/${conversationId}/receipts`,
          (frame) => {
            try {
              handlersRef.current.onReceipt?.(
                JSON.parse(frame.body)
              );
            } catch {
              setSocketError(
                "Could not read message receipt."
              );
            }
          }
        );

        // Reaction channel
        client.subscribe(
          `/topic/conversations/${conversationId}/reactions`,
          (frame) => {
            try {
              handlersRef.current.onReaction?.(
                JSON.parse(frame.body)
              );
            } catch {
              setSocketError(
                "Could not read message reaction."
              );
            }
          }
        );
      },

      onDisconnect: () => {
        setConnected(false);
      },

      onWebSocketClose: () => {
        setConnected(false);
      },

      onStompError: (frame) => {
        setConnected(false);

        const description =
          frame.headers?.message ||
          frame.body ||
          "The messaging broker rejected the connection.";

        setSocketError(description);

        // If the server rejected an expired/invalid JWT,
        // refresh it and let the effect establish a new connection.
        if (
          /jwt|token|expired|unauthorized|authentication/i.test(
            description
          ) &&
          refreshAttemptRef.current !== accessToken
        ) {
          refreshAttemptRef.current = accessToken;

          refreshAccessToken().catch(() => {
            // AuthContext receives the auth-expired event.
          });
        }
      },

      onWebSocketError: () => {
        setConnected(false);
        setSocketError(
          "Could not connect to the HushTalk WebSocket server."
        );
      }
    });

    clientRef.current = client;

    client.activate();

    return () => {
      active = false;

      clientRef.current = null;

      setConnected(false);

      client.deactivate();
    };
  }, [accessToken, conversationId]);

  const publish = useCallback(
    (destination, payload) => {
      if (!clientRef.current?.connected) {
        throw new Error(
          "The real-time connection is not ready."
        );
      }

      clientRef.current.publish({
        destination,
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    },
    []
  );

  const publishMessage = useCallback(
    (conversationId, payload) => {
      publish(
        `/app/conversations/${conversationId}/messages`,
        payload
      );
    },
    [publish]
  );

  const publishTyping = useCallback(
    (conversationId, typing) => {
      publish(
        `/app/conversations/${conversationId}/typing`,
        { typing }
      );
    },
    [publish]
  );

  return {
    connected,
    socketError,
    publishMessage,
    publishTyping
  };
}
