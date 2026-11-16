
import { Reply } from "lucide-react";

const QUICK_REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥"
];

function getReceiptLabel(receipts = []) {
  if (!receipts.length) return "Sent";

  const allRead = receipts.every(
    (receipt) => receipt.status === "READ"
  );

  if (allRead) return "Read";

  const allDelivered = receipts.every(
    (receipt) =>
      receipt.status === "DELIVERED" ||
      receipt.status === "READ"
  );

  return allDelivered ? "Delivered" : "Sent";
}

function groupReactions(reactions = []) {
  const groups = new Map();

  reactions.forEach((reaction) => {
    const existing = groups.get(reaction.type) || {
      type: reaction.type,
      count: 0,
      userIds: []
    };

    existing.count += 1;
    existing.userIds.push(reaction.userId);

    groups.set(reaction.type, existing);
  });

  return [...groups.values()];
}

export default function MessageBubble({
  message,
  mine,
  senderName,
  currentUserId,
  onReply,
  onToggleReaction
}) {
  const groupedReactions = groupReactions(
    message.reactions || []
  );

  return (
    <div
      className={`mb-5 flex ${
        mine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex max-w-[85%] flex-col md:max-w-[68%] ${
          mine ? "items-end" : "items-start"
        }`}
      >
        {!mine && (
          <span className="mb-1 ml-1 text-[11px] font-semibold text-slate-400">
            {senderName}
          </span>
        )}

        {message.replyToMessageId && (
          <div
            className={`mb-1 max-w-full rounded-xl border-l-4 border-indigo-400 px-3 py-2 text-xs ${
              mine
                ? "bg-indigo-50 text-slate-600"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <p className="font-semibold">
              Replying to{" "}
              {message.replyToSenderId
                ? senderName(message.replyToSenderId)
                : "a message"}
            </p>

            <p className="mt-1 truncate">
              {message.replyToMessageContent ||
                "Original message"}
            </p>
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            mine
              ? "rounded-br-md bg-brand text-white"
              : "rounded-bl-md border border-slate-100 bg-white text-slate-700"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-slate-400">
          <span>
            {message.createdAt
              ? new Date(message.createdAt).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit"
                  }
                )
              : ""}
          </span>

          {mine && (
            <span className="font-medium text-indigo-500">
              {getReceiptLabel(message.receipts)}
            </span>
          )}
        </div>

        {groupedReactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {groupedReactions.map((reaction) => {
              const selectedByMe =
                reaction.userIds.includes(currentUserId);

              return (
                <button
                  key={reaction.type}
                  onClick={() =>
                    onToggleReaction(message, reaction.type)
                  }
                  className={`rounded-full border px-2 py-1 text-xs ${
                    selectedByMe
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 bg-white"
                  }`}
                  title={`${reaction.count} reaction(s)`}
                >
                  {reaction.type} {reaction.count}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex items-center gap-1 opacity-80 transition hover:opacity-100">
          <button
            onClick={() => onReply(message)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-100 hover:text-brand"
          >
            <Reply size={13} />
            Reply
          </button>

          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() =>
                onToggleReaction(message, emoji)
              }
              className="rounded-md px-1 py-1 text-sm hover:bg-slate-100"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
