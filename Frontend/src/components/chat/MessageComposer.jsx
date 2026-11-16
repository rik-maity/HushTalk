
import { useEffect, useRef } from "react";
import { Send, X, CornerUpLeft } from "lucide-react";

export default function MessageComposer({
  value,
  onChange,
  onSend,
  connected,
  replyingTo,
  getSenderName,
  onCancelReply,
  onTypingChange
}) {
  const typingTimerRef = useRef(null);

  function clearTypingTimer() {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }

  function handleChange(event) {
    const nextValue = event.target.value;

    onChange(nextValue);

    clearTypingTimer();

    if (nextValue.trim()) {
      onTypingChange(true);

      typingTimerRef.current = setTimeout(() => {
        onTypingChange(false);
        typingTimerRef.current = null;
      }, 1000);
    } else {
      onTypingChange(false);
    }
  }

  function handleSubmit(event) {
    clearTypingTimer();
    onTypingChange(false);
    onSend(event);
  }

  function handleBlur() {
    clearTypingTimer();
    onTypingChange(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      event.currentTarget.form?.requestSubmit();
    }
  }

  useEffect(() => {
    return () => {
      clearTypingTimer();
    };
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-100 bg-white p-4 md:px-7 md:py-5"
    >
      {!connected && (
        <p className="mb-2 text-xs text-amber-600">
          Waiting for the real-time connection.
          You can send once connected.
        </p>
      )}

      {replyingTo && (
        <div className="mx-auto mb-3 flex max-w-4xl items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
          <CornerUpLeft
            size={17}
            className="shrink-0 text-brand"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brand">
              Replying to{" "}
              {getSenderName(replyingTo.senderId)}
            </p>

            <p className="truncate text-xs text-slate-500">
              {replyingTo.content}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
            title="Cancel reply"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-indigo-300 focus-within:bg-white">
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          rows={1}
          placeholder="Write a message…"
          className="max-h-32 min-h-[42px] flex-1 resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
        />

        <button
          type="submit"
          disabled={!connected || !value.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={17} />
        </button>
      </div>

      <p className="mt-2 text-center text-[10px] text-slate-400">
        Enter to send · Shift + Enter for a new line
      </p>
    </form>
  );
}
