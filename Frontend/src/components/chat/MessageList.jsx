
import { MessageCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import MessageBubble from "./MessageBubble";

export default function MessageList({
  messages,
  currentUserId,
  getSenderName,
  onReply,
  onToggleReaction
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  return (
    <section className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto mb-6 max-w-xl text-center">
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400">
          Messages are persisted by the HushTalk backend
        </span>
      </div>

      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          mine={message.senderId === currentUserId}
          senderName={getSenderName}
          currentUserId={currentUserId}
          onReply={onReply}
          onToggleReaction={onToggleReaction}
        />
      ))}

      {!messages.length && (
        <div className="mt-24 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <MessageCircle size={24} />
          </div>

          <h3 className="mt-4 font-semibold text-slate-700">
            No messages yet
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            Send the first message in this conversation.
          </p>
        </div>
      )}

      <div ref={bottomRef} />
    </section>
  );
}
