import { useCallback, useEffect, useState } from "react";
import {
  addConversationMember,
  createConversation,
  fetchConversations,
  fetchUsers
} from "../../api/chatApi";
import { getErrorMessage } from "../../api/client";

export default function useConversationManager({ setPageError }) {
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [conversationName, setConversationName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      try {
        const [conversationData, userData] = await Promise.all([
          fetchConversations(),
          fetchUsers()
        ]);
        if (!active) return;
        setConversations(conversationData.map((conversation) => ({
          ...conversation,
          unreadCount: Number(conversation.unreadCount || 0)
        })));
        setUsers(userData);
      } catch (error) {
        if (active) setPageError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialData();
    return () => { active = false; };
  }, [setPageError]);

  const handleSelectConversation = useCallback((conversation) => {
    setSelected(conversation);
    setConversations((current) => current.map((item) =>
      Number(item.id) === Number(conversation.id)
        ? { ...item, unreadCount: 0 }
        : item
    ));
  }, []);

  const refreshConversations = useCallback(async (preferredId) => {
    const data = await fetchConversations();
    setConversations((current) => data.map((conversation) => {
      const existing = current.find((item) => Number(item.id) === Number(conversation.id));
      return {
        ...conversation,
        unreadCount: Number(existing?.unreadCount ?? conversation.unreadCount ?? 0)
      };
    }));
    if (preferredId) {
      const item = data.find((conversation) => Number(conversation.id) === Number(preferredId));
      if (item) setSelected(item);
    }
  }, []);

  const handleCreateConversation = useCallback(async (event) => {
    event.preventDefault();
    if (!conversationName.trim()) return;
    setCreating(true);
    setPageError("");
    try {
      const created = await createConversation(conversationName.trim());
      if (memberId) await addConversationMember(created.id, memberId);
      setConversationName("");
      setMemberId("");
      setModalOpen(false);
      await refreshConversations(created.id);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }, [conversationName, memberId, refreshConversations, setPageError]);

  return {
    conversations,
    setConversations,
    users,
    selected,
    setSelected,
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
    refreshConversations,
    handleCreateConversation
  };
}
