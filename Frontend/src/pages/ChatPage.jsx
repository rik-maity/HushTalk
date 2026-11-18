
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import useInboxSocket from "../hooks/useinboxSocket";
import { MessageCircle } from "lucide-react";

import { useAuth } from "../context/AuthContext";

import {
  getErrorMessage,
  getUserIdFromToken
} from "../api/client";

import {
  addConversationMember,
  createConversation,
  fetchConversations,
  fetchConversationMembers,
  fetchMessageHistory,
  fetchMessageReceipts,
  fetchMessageReactions,
  fetchUsers,
  markMessageDelivered,
  markMessageRead,
  addMessageReaction,
  removeMessageReaction
} from "../api/chatApi";

import useConversationSocket from "../hooks/useConversationSocket";
import { useCallSocket } from "../hooks/useCallSocket";
import useWebRTC from "../hooks/useWebRTC";

import ConversationSidebar from "../components/chat/ConversationSidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageComposer from "../components/chat/MessageComposer";
import CreateConversationModal from "../components/chat/CreateConversationModal";
import Alert from "../components/ui/Alert";
import CallDialog from "../components/chat/CallDialog";

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;

        results[currentIndex] = await mapper(
          items[currentIndex]
        );
      }
    }
  );

  await Promise.all(workers);

  return results;
}

function mergeMessages(history, current) {
  const messagesById = new Map();

  [...history, ...current].forEach((message) => {
    const existing = messagesById.get(message.id);

    messagesById.set(message.id, {
      ...existing,
      ...message,
      reactions:
        message.reactions ?? existing?.reactions ?? [],
      receipts:
        message.receipts ?? existing?.receipts ?? []
    });
  });

  return [...messagesById.values()].sort(
    (a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
  );
}

export default function ChatPage() {
  const { auth, logout } = useAuth();

  const currentUserId = useMemo(
    () => getUserIdFromToken(auth.accessToken),
    [auth.accessToken]
  );

  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [conversationName, setConversationName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [creating, setCreating] = useState(false);

  const [typingUsers, setTypingUsers] = useState({});

  // -----------------------------------------
  // Phase 5: call state
  // -----------------------------------------

  const [conversationPeer, setConversationPeer] = useState(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [activeCall, setActiveCall] = useState(null);
  const [callStarting, setCallStarting] = useState(false);
  const [callError, setCallError] = useState("");
  const [callNotice, setCallNotice] = useState("");

  const typingTimeoutsRef = useRef(new Map());
  const readMarkedRef = useRef(new Set());
  const deliveredMarkedRef = useRef(new Set());
  const typingActiveRef = useRef(false);

  // Allows the signaling callback to reach the WebRTC hook.
  const webRTCRef = useRef(null);

  // -----------------------------------------
  // Receipt state helpers
  // -----------------------------------------

  const updateReceipt = useCallback((receipt) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== receipt.messageId) {
          return message;
        }

        const receipts = message.receipts || [];

        const existingIndex = receipts.findIndex(
          (item) => item.userId === receipt.userId
        );

        const updated = [...receipts];

        if (existingIndex >= 0) {
          updated[existingIndex] = receipt;
        } else {
          updated.push(receipt);
        }

        return {
          ...message,
          receipts: updated
        };
      })
    );
  }, []);

  const markIncomingMessage = useCallback(
    async (message, conversationId, shouldRead) => {
      if (Number(message.senderId) === Number(currentUserId)) return;

      if (shouldRead) {
        if (readMarkedRef.current.has(message.id)) return;

        try {
          const receipt = await markMessageRead(
            conversationId,
            message.id
          );

          readMarkedRef.current.add(message.id);
          deliveredMarkedRef.current.add(message.id);

          updateReceipt(receipt);
        } catch (error) {
          console.error(
            "Could not mark message as read:",
            error
          );
        }

        return;
      }

      if (deliveredMarkedRef.current.has(message.id)) return;

      try {
        const receipt = await markMessageDelivered(
          conversationId,
          message.id
        );

        deliveredMarkedRef.current.add(message.id);

        updateReceipt(receipt);
      } catch (error) {
        console.error(
          "Could not mark message as delivered:",
          error
        );
      }
    },
    [currentUserId, updateReceipt]
  );

  // -----------------------------------------
  // Incoming messages
  // -----------------------------------------

  const handleIncomingMessage = useCallback(
    (incoming) => {
      setMessages((current) =>
        mergeMessages(current, [incoming])
      );

      const shouldRead =
        document.visibilityState === "visible";

      void markIncomingMessage(
        incoming,
        incoming.conversationId,
        shouldRead
      );
    },
    [markIncomingMessage]
  );

  // -----------------------------------------
  // Typing events
  // -----------------------------------------

  const handleTyping = useCallback(
    (event) => {
      if (event.userId === currentUserId) return;

      const userKey = String(event.userId);

      const existingTimer =
        typingTimeoutsRef.current.get(userKey);

      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      if (!event.typing) {
        typingTimeoutsRef.current.delete(userKey);

        setTypingUsers((current) => {
          const updated = { ...current };

          delete updated[userKey];

          return updated;
        });

        return;
      }

      setTypingUsers((current) => ({
        ...current,
        [userKey]: true
      }));

      const timer = setTimeout(() => {
        setTypingUsers((current) => {
          const updated = { ...current };

          delete updated[userKey];

          return updated;
        });

        typingTimeoutsRef.current.delete(userKey);
      }, 3000);

      typingTimeoutsRef.current.set(userKey, timer);
    },
    [currentUserId]
  );

  // -----------------------------------------
  // Receipt events
  // -----------------------------------------

  const handleReceipt = useCallback(
    (receipt) => {
      updateReceipt(receipt);
    },
    [updateReceipt]
  );

  // -----------------------------------------
  // Reaction events
  // -----------------------------------------

  const handleReaction = useCallback((event) => {
    const reaction = event.reaction;

    if (!reaction) return;

    setMessages((current) =>
      current.map((message) => {
        if (message.id !== reaction.messageId) {
          return message;
        }

        const reactions = message.reactions || [];

        if (event.action === "ADDED") {
          if (
            reactions.some(
              (item) => item.id === reaction.id
            )
          ) {
            return message;
          }

          return {
            ...message,
            reactions: [...reactions, reaction]
          };
        }

        if (event.action === "REMOVED") {
          return {
            ...message,
            reactions: reactions.filter(
              (item) => item.id !== reaction.id
            )
          };
        }

        return message;
      })
    );
  }, []);

  // -----------------------------------------
  // Call signaling events
  // -----------------------------------------

  const handleCallEvent = useCallback((event) => {
    if (!event?.eventType) return;

    setCallError("");

    switch (event.eventType) {
      case "INCOMING_CALL": {
        setCallStarting(false);
        setCallNotice("");

        setActiveCall({
          ...event,
          direction: "INCOMING"
        });

        break;
      }

      case "CALL_RINGING": {
        setCallStarting(false);
        setCallNotice("");

        setActiveCall({
          ...event,
          direction: "OUTGOING"
        });

        break;
      }

      case "CALL_ACCEPTED": {
        setCallStarting(false);

        // CALL_ACCEPTED is sent from the callee to the caller.
        // Preserve the original caller/recipient IDs from CALL_RINGING.
        setActiveCall((current) =>
          current?.callId === event.callId
            ? {
                ...current,
                status: "ACCEPTED"
              }
            : current
        );

        break;
      }

      case "CALL_REJECTED": {
        setCallStarting(false);
        setCallNotice(
          "The other participant declined the call."
        );

        setActiveCall((current) =>
          current?.callId === event.callId
            ? null
            : current
        );

        break;
      }

      case "CALL_ENDED": {
        setCallStarting(false);
        setCallNotice("The call has ended.");

        setActiveCall((current) =>
          current?.callId === event.callId
            ? null
            : current
        );

        break;
      }

      // WebRTC events are passed to useWebRTC.
      case "WEBRTC_OFFER":
      case "WEBRTC_ANSWER":
      case "ICE_CANDIDATE": {
        void webRTCRef.current?.handleSignalEvent(event);
        break;
      }

      default:
        console.warn(
          "Unknown call signaling event:",
          event.eventType
        );
    }
  }, []);

  // -----------------------------------------
  // Existing conversation WebSocket
  // -----------------------------------------

  const {
    connected,
    socketError,
    publishMessage,
    publishTyping
  } = useConversationSocket({
    accessToken: auth.accessToken,
    conversationId: selected?.id,
    onMessage: handleIncomingMessage,
    onTyping: handleTyping,
    onReceipt: handleReceipt,
    onReaction: handleReaction
  });

  // -----------------------------------------
  // Separate global call signaling socket
  // -----------------------------------------

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
  } = useCallSocket({
    accessToken: auth.accessToken,
    onCallEvent: handleCallEvent
  });

  // -----------------------------------------
  // WebRTC hook
  // -----------------------------------------

  const webRTC = useWebRTC({
    call: activeCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate
  });

  // Keep the latest handler available to STOMP events.
  webRTCRef.current = webRTC;

  // -----------------------------------------
  // Typing publisher
  // -----------------------------------------

  const handleTypingChange = useCallback(
    (typing) => {
      if (!selected || !connected) return;

      if (typingActiveRef.current === typing) return;

      typingActiveRef.current = typing;

      try {
        publishTyping(selected.id, typing);
      } catch (error) {
        console.error(
          "Typing event failed:",
          error
        );
      }
    },
    [selected?.id, connected, publishTyping]
  );

  useEffect(() => {
    return () => {
      if (typingActiveRef.current && selected?.id) {
        try {
          publishTyping(selected.id, false);
        } catch {
          // Socket may already be disconnected.
        }
      }

      typingActiveRef.current = false;
    };
  }, [selected?.id, publishTyping]);

  useEffect(() => {
    return () => {
      typingTimeoutsRef.current.forEach(clearTimeout);
      typingTimeoutsRef.current.clear();
    };
  }, []);

  //------------------------------------------
  // Global inbox WebSocket (for notifications of new conversations)
  //------------------------------------------
// -----------------------------------------
// Global inbox WebSocket
// -----------------------------------------

// -----------------------------------------
// Global inbox message handler
// -----------------------------------------

const handleInboxMessage = useCallback(
  (incoming) => {
    if (!incoming?.id || !incoming?.conversationId) return;

    const conversationId = Number(incoming.conversationId);

    const isOwnMessage =
      Number(incoming.senderId) === Number(currentUserId);

    const isOpenAndVisible =
      Number(selected?.id) === conversationId &&
      document.visibilityState === "visible";

    setConversations((current) => {
      const existing = current.find(
        (item) => Number(item.id) === conversationId
      );

      // Ignore events for conversations not present in the inbox.
      if (!existing) return current;

      const updatedConversation = {
        ...existing,
        lastMessage: incoming,
        unreadCount:
          isOwnMessage || isOpenAndVisible
            ? Number(existing.unreadCount || 0)
            : Number(existing.unreadCount || 0) + 1
      };

      // Move the conversation with the newest message to the top.
      return [
        updatedConversation,
        ...current.filter(
          (item) => Number(item.id) !== conversationId
        )
      ];
    });

    // Mark incoming messages as delivered.
    // The conversation socket handles READ when appropriate.
  if (
  !isOwnMessage &&
  Number(selected?.id) !== conversationId
) {
  void markIncomingMessage(
    incoming,
    conversationId,
    false
  );
}
  },
  [currentUserId, selected?.id, markIncomingMessage]
);

const {
  connected: inboxConnected,
  socketError: inboxSocketError
} = useInboxSocket({
  accessToken: auth.accessToken,
  onInboxMessage: handleInboxMessage
});
  // -----------------------------------------
  // Load the other participant for one-to-one calls
  // -----------------------------------------

  useEffect(() => {
    let active = true;

    setConversationPeer(null);
    setMembersLoading(false);

    if (!selected?.id) {
      return undefined;
    }

    setMembersLoading(true);

    async function loadConversationPeer() {
      try {
        const members = await fetchConversationMembers(
          selected.id
        );

        if (!active) return;

        if (
          !Array.isArray(members) ||
          members.length !== 2
        ) {
          setConversationPeer(null);
          return;
        }

        const peer = members.find((member) => {
          const memberId =
            member.id ??
            member.userId ??
            member.user?.id;

          return Number(memberId) !== Number(currentUserId);
        });

        if (!peer) {
          setConversationPeer(null);
          return;
        }

        const peerId =
          peer.id ??
          peer.userId ??
          peer.user?.id;

        setConversationPeer({
          ...peer,
          id: peerId,
          username:
            peer.username ??
            peer.user?.username ??
            `User ${peerId}`
        });
      } catch (error) {
        if (active) {
          setConversationPeer(null);

          setCallError(
            `Could not load conversation members: ${getErrorMessage(error)}`
          );
        }
      } finally {
        if (active) {
          setMembersLoading(false);
        }
      }
    }

    loadConversationPeer();

    return () => {
      active = false;
    };
  }, [selected?.id, currentUserId]);

  // -----------------------------------------
  // Start an outgoing call
  // -----------------------------------------

  
async function handleStartCall(callType) {
  if (
    !selected ||
    !conversationPeer ||
    !callConnected ||
    activeCall ||
    callStarting
  ) {
    return;
  }

  const normalizedCallType =
    String(callType).toUpperCase();

  if (!["AUDIO", "VIDEO"].includes(normalizedCallType)) {
    setCallError("Unsupported call type.");
    return;
  }

  setCallError("");
  setCallNotice("");
  setCallStarting(true);

  try {
    initiateCall(
      selected.id,
      conversationPeer.id,
      normalizedCallType
    );
  } catch (error) {
    setCallStarting(false);
    setCallError(getErrorMessage(error));
  }
}


  // -----------------------------------------
  // Accept incoming call
  // -----------------------------------------

  async function handleAcceptCall() {
    if (!activeCall?.callId) return;

    setCallError("");

    try {
      acceptCall(activeCall.callId);

      // The callee needs local ACCEPTED state so that
      // useWebRTC can request microphone access.
      // The callee waits for WEBRTC_OFFER from the caller.
      setActiveCall((current) =>
        current?.callId === activeCall.callId
          ? {
              ...current,
              status: "ACCEPTED"
            }
          : current
      );
    } catch (error) {
      setCallError(getErrorMessage(error));
    }
  }

  // -----------------------------------------
  // Reject incoming call
  // -----------------------------------------

  function handleRejectCall() {
    if (!activeCall?.callId) return;

    setCallError("");

    try {
      rejectCall(activeCall.callId);

      setActiveCall(null);
      setCallNotice("Call declined.");
    } catch (error) {
      setCallError(getErrorMessage(error));
    }
  }

  // -----------------------------------------
  // End active call
  // -----------------------------------------

  function handleEndCall() {
    if (!activeCall?.callId) return;

    setCallError("");

    try {
      endCall(activeCall.callId);

      setActiveCall(null);
      setCallNotice("Call ended.");
    } catch (error) {
      setCallError(getErrorMessage(error));
    }
  }

  // -----------------------------------------
  // Call button state
  // -----------------------------------------

  const canCall = Boolean(
    selected &&
    conversationPeer &&
    callConnected &&
    !activeCall &&
    !callStarting
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


  // -----------------------------------------
// Select conversation and clear unread count
// -----------------------------------------

const handleSelectConversation = useCallback((conversation) => {
  setSelected(conversation);

  setConversations((current) =>
    current.map((item) =>
      Number(item.id) === Number(conversation.id)
        ? { ...item, unreadCount: 0 }
        : item
    )
  );
}, []);
  // -----------------------------------------
  // Initial data
  // -----------------------------------------

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const [
          conversationData,
          userData
        ] = await Promise.all([
          fetchConversations(),
          fetchUsers()
        ]);

        if (active) {
  setConversations(
    conversationData.map((conversation) => ({
      ...conversation,
      unreadCount: Number(conversation.unreadCount || 0)
    }))
  );

  setUsers(userData);
}
      } catch (error) {
        if (active) {
          setPageError(getErrorMessage(error));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  // -----------------------------------------
  // Message history and historical reactions/receipts
  // -----------------------------------------

  useEffect(() => {
    let active = true;

    setMessages([]);
    setReplyingTo(null);
    setTypingUsers({});

    readMarkedRef.current.clear();
    deliveredMarkedRef.current.clear();

    if (!selected) {
      return undefined;
    }

    async function loadHistory() {
      try {
        const history = await fetchMessageHistory(
          selected.id
        );

        // Backend returns newest first.
        const orderedHistory = [...history].reverse();

        const hydrated = await mapWithConcurrency(
          orderedHistory,
          5,
          async (message) => {
            const [reactions, receipts] = await Promise.all([
              fetchMessageReactions(
                selected.id,
                message.id
              ).catch(() => []),

              message.senderId === currentUserId
                ? fetchMessageReceipts(
                    selected.id,
                    message.id
                  ).catch(() => [])
                : Promise.resolve([])
            ]);

            return {
              ...message,
              reactions,
              receipts
            };
          }
        );

        if (!active) return;

        setMessages((current) =>
          mergeMessages(hydrated, current)
        );

        // Loading the conversation means incoming messages
        // have reached this user's device.
        for (const message of orderedHistory) {
          if (message.senderId !== currentUserId) {
            void markIncomingMessage(
              message,
              selected.id,
              document.visibilityState === "visible"
            );
          }
        }
      } catch (error) {
        if (active) {
          setPageError(getErrorMessage(error));
        }
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [
    selected?.id,
    currentUserId,
    markIncomingMessage
  ]);

  // -----------------------------------------
  // Mark messages read when tab becomes visible
  // -----------------------------------------

  useEffect(() => {
    if (!selected) return undefined;

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;

      setConversations((current) =>
  current.map((conversation) =>
    Number(conversation.id) === Number(selected.id)
      ? { ...conversation, unreadCount: 0 }
      : conversation
  )
);

      messages.forEach((message) => {
        if (message.senderId !== currentUserId) {
          void markIncomingMessage(
            message,
            selected.id,
            true
          );
        }
      });
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    messages,
    selected?.id,
    currentUserId,
    markIncomingMessage
  ]);

  // -----------------------------------------
  // Conversation actions
  // -----------------------------------------

  async function refreshConversations(preferredId) {
  const data = await fetchConversations();

  setConversations((current) =>
    data.map((conversation) => {
      const existing = current.find(
        (item) => Number(item.id) === Number(conversation.id)
      );

      return {
        ...conversation,
        unreadCount: Number(
          existing?.unreadCount ??
          conversation.unreadCount ??
          0
        )
      };
    })
  );

  if (preferredId) {
    const item = data.find(
      (conversation) =>
        Number(conversation.id) === Number(preferredId)
    );

    if (item) {
      setSelected(item);
    }
  }
}

  async function handleCreateConversation(event) {
    event.preventDefault();

    if (!conversationName.trim()) return;

    setCreating(true);
    setPageError("");

    try {
      const created = await createConversation(
        conversationName.trim()
      );

      if (memberId) {
        await addConversationMember(
          created.id,
          memberId
        );
      }

      setConversationName("");
      setMemberId("");
      setModalOpen(false);

      await refreshConversations(created.id);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  // -----------------------------------------
  // Send message / reply
  // -----------------------------------------

  function handleSendMessage(event) {
    event.preventDefault();

    const content = draft.trim();

    if (!content || !selected || !connected) return;

    try {
      publishMessage(selected.id, {
        content,
        replyToMessageId: replyingTo?.id ?? null
      });

      setDraft("");
      setReplyingTo(null);

      handleTypingChange(false);
    } catch (error) {
      setPageError(error.message);
    }
  }

  // -----------------------------------------
  // Reactions
  // -----------------------------------------

  async function handleToggleReaction(message, type) {
    if (!selected) return;

    const existing = (message.reactions || []).find(
      (reaction) =>
        reaction.userId === currentUserId &&
        reaction.type === type
    );

    try {
      if (existing) {
        await removeMessageReaction(
          selected.id,
          message.id,
          type
        );

        setMessages((current) =>
          current.map((item) =>
            item.id !== message.id
              ? item
              : {
                  ...item,
                  reactions: (item.reactions || []).filter(
                    (reaction) =>
                      reaction.id !== existing.id
                  )
                }
          )
        );
      } else {
        const created = await addMessageReaction(
          selected.id,
          message.id,
          type
        );

        setMessages((current) =>
          current.map((item) =>
            item.id !== message.id
              ? item
              : {
                  ...item,
                  reactions: [
                    ...(item.reactions || []).filter(
                      (reaction) =>
                        !(
                          reaction.userId === created.userId &&
                          reaction.type === created.type
                        )
                    ),
                    created
                  ]
                }
          )
        );
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  // -----------------------------------------
  // Display helpers
  // -----------------------------------------

  const senderName = (senderId) => {
    const user = users.find(
      (item) => item.id === senderId
    );

    return senderId === currentUserId
      ? "You"
      : user?.username || `User ${senderId}`;
  };

  const typingNames = Object.keys(typingUsers)
    .map(Number)
    .map(senderName);

  // -----------------------------------------
  // Render
  // -----------------------------------------

  return (
    <div className="min-h-screen bg-slate-100 p-0 text-ink md:p-5">
      <div className="mx-auto flex h-screen max-h-[920px] max-w-[1440px] overflow-hidden bg-white shadow-panel md:rounded-3xl md:border md:border-slate-200">

        {/* Conversation sidebar */}
        <div
          className={`${
            selected ? "hidden md:flex" : "flex"
          } w-full shrink-0 md:w-[330px] lg:w-[360px]`}
        >
          <ConversationSidebar
            conversations={conversations}
            selectedId={selected?.id}
            onSelect={handleSelectConversation}
            onCreate={() => setModalOpen(true)}
            onLogout={logout}
            search={search}
            onSearch={setSearch}
            currentUserId={currentUserId}
          />
        </div>

        {/* Main chat area */}
        <main
          className={`${
            selected ? "flex" : "hidden md:flex"
          } min-w-0 flex-1 flex-col bg-[#fbfcff]`}
        >
          {pageError && (
            <div className="m-4">
              <Alert>{pageError}</Alert>
            </div>
          )}

          {inboxSocketError && (
  <div className="mx-4 mt-2">
    <Alert>{inboxSocketError}</Alert>
  </div>
)}

          {selected ? (
            <>
              <ChatHeader
                conversation={selected}
                connected={connected}
                onBack={() => setSelected(null)}
                canCall={canCall}
                callDisabledReason={callDisabledReason}
                onStartCall={handleStartCall}
                callStarting={callStarting}
              />

              {socketError && (
                <div className="mx-5 mt-3">
                  <Alert>{socketError}</Alert>
                </div>
              )}

              {callSocketError && (
                <div className="mx-5 mt-3">
                  <Alert>{callSocketError}</Alert>
                </div>
              )}

              {callError && (
                <div className="mx-5 mt-3">
                  <Alert>{callError}</Alert>
                </div>
              )}

              {callNotice && (
                <div className="mx-5 mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                  {callNotice}
                </div>
              )}

              {typingNames.length > 0 && (
                <div className="border-b border-slate-100 bg-white px-7 py-2 text-xs text-brand">
                  {typingNames.length === 1
                    ? `${typingNames[0]} is typing…`
                    : `${typingNames.join(", ")} are typing…`}
                </div>
              )}

              <MessageList
                messages={messages}
                currentUserId={currentUserId}
                getSenderName={senderName}
                onReply={setReplyingTo}
                onToggleReaction={handleToggleReaction}
              />

              <MessageComposer
                value={draft}
                onChange={setDraft}
                onSend={handleSendMessage}
                connected={connected}
                replyingTo={replyingTo}
                getSenderName={senderName}
                onCancelReply={() => setReplyingTo(null)}
                onTypingChange={handleTypingChange}
              />
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-soft text-brand">
                  <MessageCircle size={28} />
                </div>

                <h2 className="mt-5 text-xl font-bold">
                  Your conversations, all in one place
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Choose a conversation from the left, or create
                  one to start chatting.
                </p>

                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600"
                >
                  New conversation
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Global call dialog: visible even without a selected chat */}
      
<CallDialog
  call={activeCall}
  participantName={
    activeCall
      ? (
          users.find((user) =>
            Number(user.id) === Number(
              activeCall.direction === "INCOMING"
                ? activeCall.fromUserId
                : activeCall.toUserId
            )
          )?.username ||
          (
            activeCall.direction === "INCOMING"
              ? "HushTalk user"
              : conversationPeer?.username || "HushTalk user"
          )
        )
      : ""
  }
  onAccept={handleAcceptCall}
  onReject={handleRejectCall}
  onEnd={handleEndCall}

  localStream={webRTC.localStream}
  remoteStream={webRTC.remoteStream}

  connectionState={webRTC.connectionState}
  mediaError={webRTC.mediaError}

  isMuted={webRTC.isMuted}
  isCameraOn={webRTC.isCameraOn}

  onToggleMute={webRTC.toggleMute}
  onToggleCamera={webRTC.toggleCamera}
/>


      {/* Create conversation modal */}
      <CreateConversationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        name={conversationName}
        onNameChange={setConversationName}
        memberId={memberId}
        onMemberChange={setMemberId}
        users={users}
        currentUserId={currentUserId}
        busy={creating}
        onSubmit={handleCreateConversation}
      />

      {loading && (
        <div className="fixed bottom-4 right-4 rounded-full bg-white px-4 py-2 text-xs text-slate-500 shadow">
          Loading HushTalk…
        </div>
      )}
    </div>
  );
}
