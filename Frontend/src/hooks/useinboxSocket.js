import {
  useEffect,
  useRef,
  useState
} from "react";

import { Client } from "@stomp/stompjs";

import {
  WS_URL,
  refreshAccessToken
} from "../api/client";

export default function useInboxSocket({
  accessToken,
  onInboxMessage
}) {
  const handlerRef = useRef(onInboxMessage);
  const refreshAttemptRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState("");

  useEffect(() => {
    handlerRef.current = onInboxMessage;
  }, [onInboxMessage]);

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

        client.subscribe("/user/queue/inbox", (frame) => {
          try {
            const message = JSON.parse(frame.body);
            handlerRef.current?.(message);
          } catch (error) {
            console.error(
              "Could not parse inbox message event:",
              error
            );

            setSocketError(
              "Could not read an incoming inbox message."
            );
          }
        });
      },

      onDisconnect: () => {
        if (active) setConnected(false);
      },

      onWebSocketClose: () => {
        if (active) setConnected(false);
      },

      onStompError: (frame) => {
        if (!active) return;

        setConnected(false);

        const description =
          frame.headers?.message ||
          frame.body ||
          "The inbox messaging broker rejected the connection.";

        setSocketError(description);

        if (
          /jwt|token|expired|unauthorized|authentication/i.test(
            description
          ) &&
          refreshAttemptRef.current !== accessToken
        ) {
          refreshAttemptRef.current = accessToken;

          refreshAccessToken().catch(() => {
            // AuthContext handles the expired-session flow.
          });
        }
      },

      onWebSocketError: () => {
        if (!active) return;

        setConnected(false);
        setSocketError(
          "Could not connect to the HushTalk inbox server."
        );
      }
    });

    client.activate();

    return () => {
      active = false;
      setConnected(false);
      void client.deactivate();
    };
  }, [accessToken]);

  return {
    connected,
    socketError
  };
}
