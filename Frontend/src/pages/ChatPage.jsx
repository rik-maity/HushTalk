
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

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

import ConversationSidebar from "../components/chat/ConversationSidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageComposer from "../components/chat/MessageComposer";
import CreateConversationModal from "../components/chat/CreateConversationModal";
import Alert from "../components/ui/Alert";

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

  const typingTimeoutsRef = useRef(new Map());
  const readMarkedRef = useRef(new Set());
  const deliveredMarkedRef = useRef(new Set());
  const typingActiveRef = useRef(false);

  // --------------------
  // Receipt state helpers
  // --------------------

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
      if (message.senderId === currentUserId) return;

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
          console.error("Could not mark message as read:", error);
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
        console.error("Could not mark message as delivered:", error);
      }
    },
    [currentUserId, updateReceipt]
  );

  // --------------------
  // Incoming messages
  // --------------------

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

  // --------------------
  // Typing events
  // --------------------

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

  // --------------------
  // Receipt events
  // --------------------

  const handleReceipt = useCallback(
    (receipt) => {
      updateReceipt(receipt);
    },
    [updateReceipt]
  );

  // --------------------
  // Reaction events
  // --------------------

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

  // --------------------
  // WebSocket
  // --------------------

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

  // --------------------
  // Typing publisher
  // --------------------

  const handleTypingChange = useCallback(
    (typing) => {
      if (!selected || !connected) return;

      if (typingActiveRef.current === typing) return;

      typingActiveRef.current = typing;

      try {
        publishTyping(selected.id, typing);
      } catch (error) {
        console.error("Typing event failed:", error);
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

  // --------------------
  // Initial data
  // --------------------

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
          setConversations(conversationData);
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

  // --------------------
  // Message history and
  // historical reactions/receipts
  // --------------------

  useEffect(() => {
    let active = true;

    setMessages([]);
    setReplyingTo(null);
    setTypingUsers({});

    readMarkedRef.current.clear();
    deliveredMarkedRef.current.clear();

    if (!selected) return undefined;

    async function loadHistory() {
      try {
        const history = await fetchMessageHistory(selected.id);

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

  // --------------------
  // Mark messages read
  // when the tab becomes visible
  // --------------------

  useEffect(() => {
    if (!selected) return undefined;

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;

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

  // --------------------
  // Conversation actions
  // --------------------

  async function refreshConversations(preferredId) {
    const data = await fetchConversations();

    setConversations(data);

    if (preferredId) {
      const item = data.find(
        (conversation) => conversation.id === preferredId
      );

      if (item) setSelected(item);
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

  // --------------------
  // Send message / reply
  // --------------------

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

  // --------------------
  // Reactions
  // --------------------

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

  // --------------------
  // Display helpers
  // --------------------

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

  return (
    <div className="min-h-screen bg-slate-100 p-0 text-ink md:p-5">
      <div className="mx-auto flex h-screen max-h-[920px] max-w-[1440px] overflow-hidden bg-white shadow-panel md:rounded-3xl md:border md:border-slate-200">

        <div
          className={`${
            selected ? "hidden md:flex" : "flex"
          } w-full shrink-0 md:w-[330px] lg:w-[360px]`}
        >
          <ConversationSidebar
            conversations={conversations}
            selectedId={selected?.id}
            onSelect={setSelected}
            onCreate={() => setModalOpen(true)}
            onLogout={logout}
            search={search}
            onSearch={setSearch}
            currentUserId={currentUserId}
          />
        </div>

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

          {selected ? (
            <>
              <ChatHeader
                conversation={selected}
                connected={connected}
                onBack={() => setSelected(null)}
              />

              {socketError && (
                <div className="mx-5 mt-3">
                  <Alert>{socketError}</Alert>
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
