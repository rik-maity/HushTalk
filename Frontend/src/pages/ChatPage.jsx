import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserIdFromToken } from "../api/client";
import useInboxSocket from "../hooks/useinboxSocket";
import useConversationSocket from "../hooks/useConversationSocket";
import useConversationManager from "../hooks/chat/useConversationManager";
import useMessageManager from "../hooks/chat/useMessageManager";
import useTypingManager from "../hooks/chat/useTypingManager";
import useCallManager from "../hooks/chat/useCallManager";
import ConversationSidebar from "../components/chat/ConversationSidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageComposer from "../components/chat/MessageComposer";
import CreateConversationModal from "../components/chat/CreateConversationModal";
import Alert from "../components/ui/Alert";
import CallDialog from "../components/chat/CallDialog";

export default function ChatPage() {
  const { auth, logout } = useAuth();
  const [pageError, setPageError] = useState("");
  const currentUserId = useMemo(
    () => getUserIdFromToken(auth.accessToken),
    [auth.accessToken]
  );

  const conversations = useConversationManager({ setPageError });
  const {
    selected,
    setSelected,
    setConversations,
    users,
    search,
    setSearch,
    loading,
    modalOpen,
    setModalOpen,
    conversationName,
    setConversationName,
    memberId,
    setMemberId,
    creating,
    handleSelectConversation,
    handleCreateConversation
  } = conversations;

  const handleConversationRead = useCallback((conversationId) => {
    setConversations((current) => current.map((conversation) =>
      Number(conversation.id) === Number(conversationId)
        ? { ...conversation, unreadCount: 0 }
        : conversation
    ));
  }, [setConversations]);

  const messaging = useMessageManager({
    selected,
    currentUserId,
    setPageError,
    onConversationRead: handleConversationRead
  });
  const typing = useTypingManager({
    currentUserId,
    conversationId: selected?.id
  });
  const call = useCallManager({
    accessToken: auth.accessToken,
    selected,
    currentUserId
  });

  const {
    connected,
    socketError,
    publishMessage,
    publishTyping
  } = useConversationSocket({
    accessToken: auth.accessToken,
    conversationId: selected?.id,
    onMessage: messaging.handleIncomingMessage,
    onTyping: typing.handleTyping,
    onReceipt: messaging.handleReceipt,
    onReaction: messaging.handleReaction
  });

  const typingActiveRef = useRef(false);
  const handleTypingChange = useCallback((isTyping) => {
    if (!selected?.id || !connected || typingActiveRef.current === isTyping) return;
    typingActiveRef.current = isTyping;
    try {
      publishTyping(selected.id, isTyping);
    } catch (error) {
      console.error("Typing event failed:", error);
    }
  }, [selected?.id, connected, publishTyping]);

  useEffect(() => () => {
    if (typingActiveRef.current && selected?.id) {
      try { publishTyping(selected.id, false); } catch { /* Socket may already be disconnected. */ }
    }
    typingActiveRef.current = false;
  }, [selected?.id, publishTyping]);

  const handleInboxMessage = useCallback((incoming) => {
    if (!incoming?.id || !incoming?.conversationId) return;
    const conversationId = Number(incoming.conversationId);
    const isOwnMessage = Number(incoming.senderId) === Number(currentUserId);
    const isOpenAndVisible = Number(selected?.id) === conversationId &&
      document.visibilityState === "visible";

    setConversations((current) => {
      const existing = current.find((item) => Number(item.id) === conversationId);
      if (!existing) return current;
      const updatedConversation = {
        ...existing,
        lastMessage: incoming,
        unreadCount: isOwnMessage || isOpenAndVisible
          ? Number(existing.unreadCount || 0)
          : Number(existing.unreadCount || 0) + 1
      };
      return [
        updatedConversation,
        ...current.filter((item) => Number(item.id) !== conversationId)
      ];
    });

    if (!isOwnMessage && Number(selected?.id) !== conversationId) {
      void messaging.markIncomingMessage(incoming, conversationId, false);
    }
  }, [currentUserId, selected?.id, setConversations, messaging.markIncomingMessage]);

  const { socketError: inboxSocketError } = useInboxSocket({
    accessToken: auth.accessToken,
    onInboxMessage: handleInboxMessage
  });

  const senderName = useCallback((senderId) => {
    const user = users.find((item) => Number(item.id) === Number(senderId));
    return Number(senderId) === Number(currentUserId)
      ? "You"
      : user?.username || `User ${senderId}`;
  }, [users, currentUserId]);

  const typingNames = Object.keys(typing.typingUsers).map(Number).map(senderName);

  const callParticipantName = call.activeCall
    ? (
        users.find((user) => Number(user.id) === Number(
          call.activeCall.direction === "INCOMING"
            ? call.activeCall.fromUserId
            : call.activeCall.toUserId
        ))?.username ||
        (call.activeCall.direction === "INCOMING"
          ? "HushTalk user"
          : call.conversationPeer?.username || "HushTalk user")
      )
    : "";

  return (
    <div className="min-h-screen bg-slate-100 p-0 text-ink md:p-5">
      <div className="mx-auto flex h-screen max-h-[920px] max-w-[1440px] overflow-hidden bg-white shadow-panel md:rounded-3xl md:border md:border-slate-200">
        <div className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 md:w-[330px] lg:w-[360px]`}>
          <ConversationSidebar
            conversations={conversations.conversations}
            selectedId={selected?.id}
            onSelect={handleSelectConversation}
            onCreate={() => setModalOpen(true)}
            onLogout={logout}
            search={search}
            onSearch={setSearch}
            currentUserId={currentUserId}
          />
        </div>

        <main className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[#fbfcff]`}>
          {pageError && <div className="m-4"><Alert>{pageError}</Alert></div>}
          {inboxSocketError && <div className="mx-4 mt-2"><Alert>{inboxSocketError}</Alert></div>}

          {selected ? (
            <>
              <ChatHeader
                conversation={selected}
                connected={connected}
                onBack={() => setSelected(null)}
                canCall={call.canCall}
                callDisabledReason={call.callDisabledReason}
                onStartCall={call.handleStartCall}
                callStarting={call.callStarting}
              />

              {socketError && <div className="mx-5 mt-3"><Alert>{socketError}</Alert></div>}
              {call.callSocketError && <div className="mx-5 mt-3"><Alert>{call.callSocketError}</Alert></div>}
              {call.callError && <div className="mx-5 mt-3"><Alert>{call.callError}</Alert></div>}
              {call.callNotice && (
                <div className="mx-5 mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                  {call.callNotice}
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
                messages={messaging.messages}
                currentUserId={currentUserId}
                getSenderName={senderName}
                onReply={messaging.setReplyingTo}
                onToggleReaction={messaging.handleToggleReaction}
              />

              <MessageComposer
                value={messaging.draft}
                onChange={messaging.setDraft}
                onSend={(event) => messaging.handleSendMessage(
                  event,
                  publishMessage,
                  connected,
                  handleTypingChange
                )}
                connected={connected}
                replyingTo={messaging.replyingTo}
                getSenderName={senderName}
                onCancelReply={() => messaging.setReplyingTo(null)}
                onTypingChange={handleTypingChange}
              />
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-soft text-brand">
                  <MessageCircle size={28} />
                </div>
                <h2 className="mt-5 text-xl font-bold">Your conversations, all in one place</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Choose a conversation from the left, or create one to start chatting.
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

      <CallDialog
        call={call.activeCall}
        participantName={callParticipantName}
        onAccept={call.handleAcceptCall}
        onReject={call.handleRejectCall}
        onEnd={call.handleEndCall}
        localStream={call.webRTC.localStream}
        remoteStream={call.webRTC.remoteStream}
        connectionState={call.webRTC.connectionState}
        mediaError={call.webRTC.mediaError}
        isMuted={call.webRTC.isMuted}
        isCameraOn={call.webRTC.isCameraOn}
        onToggleMute={call.webRTC.toggleMute}
        onToggleCamera={call.webRTC.toggleCamera}
      />

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
