import { useCallback, useEffect, useRef, useState } from "react";
import {
  addMessageReaction,
  fetchMessageHistory,
  fetchMessageReceipts,
  fetchMessageReactions,
  markMessageDelivered,
  markMessageRead,
  removeMessageReaction
} from "../../api/chatApi";
import { getErrorMessage } from "../../api/client";
import { mergeMessages } from "../../utils/chat/mergeMessages";
import { mapWithConcurrency } from "../../utils/chat/mapWithConcurrency";

export default function useMessageManager({
  selected,
  currentUserId,
  setPageError,
  onConversationRead
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const readMarkedRef = useRef(new Set());
  const deliveredMarkedRef = useRef(new Set());

  const updateReceipt = useCallback((receipt) => {
    if (!receipt?.messageId) return;

    setMessages((current) => current.map((message) => {
      if (Number(message.id) !== Number(receipt.messageId)) return message;
      const receipts = message.receipts || [];
      const index = receipts.findIndex(
        (item) => Number(item.userId) === Number(receipt.userId)
      );
      const updated = [...receipts];
      if (index >= 0) updated[index] = receipt;
      else updated.push(receipt);
      return { ...message, receipts: updated };
    }));
  }, []);

  const markIncomingMessage = useCallback(async (message, conversationId, shouldRead) => {
    if (!message || Number(message.senderId) === Number(currentUserId)) return;
    const messageId = message.id;
    if (shouldRead) {
      if (readMarkedRef.current.has(messageId)) return;
      try {
        const receipt = await markMessageRead(conversationId, messageId);
        readMarkedRef.current.add(messageId);
        deliveredMarkedRef.current.add(messageId);
        updateReceipt(receipt);
      } catch (error) {
        console.error("Could not mark message as read:", error);
      }
      return;
    }
    if (deliveredMarkedRef.current.has(messageId)) return;
    try {
      const receipt = await markMessageDelivered(conversationId, messageId);
      deliveredMarkedRef.current.add(messageId);
      updateReceipt(receipt);
    } catch (error) {
      console.error("Could not mark message as delivered:", error);
    }
  }, [currentUserId, updateReceipt]);

  const handleIncomingMessage = useCallback((incoming) => {
    if (!incoming?.id) return;
    setMessages((current) => mergeMessages(current, [incoming]));
    void markIncomingMessage(
      incoming,
      incoming.conversationId,
      document.visibilityState === "visible"
    );
  }, [markIncomingMessage]);

  const handleReceipt = useCallback((receipt) => updateReceipt(receipt), [updateReceipt]);

  const handleReaction = useCallback((event) => {
    const reaction = event?.reaction;
    if (!reaction) return;
    setMessages((current) => current.map((message) => {
      if (Number(message.id) !== Number(reaction.messageId)) return message;
      const reactions = message.reactions || [];
      if (event.action === "ADDED") {
        if (reactions.some((item) => item.id === reaction.id)) return message;
        return { ...message, reactions: [...reactions, reaction] };
      }
      if (event.action === "REMOVED") {
        return {
          ...message,
          reactions: reactions.filter((item) => item.id !== reaction.id)
        };
      }
      return message;
    }));
  }, []);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setReplyingTo(null);
    setDraft("");
    readMarkedRef.current.clear();
    deliveredMarkedRef.current.clear();
    if (!selected?.id) return undefined;

    async function loadHistory() {
      try {
        const history = await fetchMessageHistory(selected.id);
        const orderedHistory = [...history].reverse();
        const hydrated = await mapWithConcurrency(orderedHistory, 5, async (message) => {
          const [reactions, receipts] = await Promise.all([
            fetchMessageReactions(selected.id, message.id).catch(() => []),
            Number(message.senderId) === Number(currentUserId)
              ? fetchMessageReceipts(selected.id, message.id).catch(() => [])
              : Promise.resolve([])
          ]);
          return { ...message, reactions, receipts };
        });
        if (!active) return;
        setMessages((current) => mergeMessages(hydrated, current));
        for (const message of orderedHistory) {
          if (Number(message.senderId) !== Number(currentUserId)) {
            void markIncomingMessage(
              message,
              selected.id,
              document.visibilityState === "visible"
            );
          }
        }
      } catch (error) {
        if (active) setPageError(getErrorMessage(error));
      }
    }
    void loadHistory();
    return () => { active = false; };
  }, [selected?.id, currentUserId, markIncomingMessage, setPageError]);

  useEffect(() => {
    if (!selected?.id) return undefined;
    const conversationId = selected.id;
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      onConversationRead?.(conversationId);
      messages.forEach((message) => {
        if (Number(message.senderId) !== Number(currentUserId)) {
          void markIncomingMessage(message, conversationId, true);
        }
      });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [messages, selected?.id, currentUserId, markIncomingMessage, onConversationRead]);

  const handleSendMessage = useCallback((event, publishMessage, connected, onTypingChange) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selected?.id || !connected) return;
    try {
      publishMessage(selected.id, {
        content,
        replyToMessageId: replyingTo?.id ?? null
      });
      setDraft("");
      setReplyingTo(null);
      onTypingChange?.(false);
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }, [draft, selected?.id, replyingTo, setPageError]);

  const handleToggleReaction = useCallback(async (message, type) => {
    if (!selected?.id) return;
    const existing = (message.reactions || []).find(
      (reaction) => Number(reaction.userId) === Number(currentUserId) && reaction.type === type
    );
    try {
      if (existing) {
        await removeMessageReaction(selected.id, message.id, type);
        setMessages((current) => current.map((item) => item.id !== message.id ? item : {
          ...item,
          reactions: (item.reactions || []).filter((reaction) => reaction.id !== existing.id)
        }));
      } else {
        const created = await addMessageReaction(selected.id, message.id, type);
        setMessages((current) => current.map((item) => item.id !== message.id ? item : {
          ...item,
          reactions: [
            ...(item.reactions || []).filter((reaction) => !(
              Number(reaction.userId) === Number(created.userId) && reaction.type === created.type
            )),
            created
          ]
        }));
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }, [selected?.id, currentUserId, setPageError]);

  return {
    messages,
    draft,
    setDraft,
    replyingTo,
    setReplyingTo,
    handleIncomingMessage,
    handleReceipt,
    handleReaction,
    handleSendMessage,
    handleToggleReaction,
    markIncomingMessage
  };
}
