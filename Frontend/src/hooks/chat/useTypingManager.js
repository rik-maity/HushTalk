import { useCallback, useEffect, useRef, useState } from "react";

export default function useTypingManager({ currentUserId, conversationId }) {
  const [typingUsers, setTypingUsers] = useState({});
  const timeoutRefs = useRef(new Map());

  const handleTyping = useCallback((event) => {
    if (!event || Number(event.userId) === Number(currentUserId)) return;
    const key = String(event.userId);
    const previousTimer = timeoutRefs.current.get(key);
    if (previousTimer) clearTimeout(previousTimer);

    if (!event.typing) {
      timeoutRefs.current.delete(key);
      setTypingUsers((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }

    setTypingUsers((current) => ({ ...current, [key]: true }));
    const timer = setTimeout(() => {
      setTypingUsers((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      timeoutRefs.current.delete(key);
    }, 3000);
    timeoutRefs.current.set(key, timer);
  }, [currentUserId]);

  useEffect(() => {
    setTypingUsers({});
  }, [conversationId]);

  useEffect(() => () => {
    timeoutRefs.current.forEach((timer) => clearTimeout(timer));
    timeoutRefs.current.clear();
  }, []);

  return { typingUsers, handleTyping };
}
