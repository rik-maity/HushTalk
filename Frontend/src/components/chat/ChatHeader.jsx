
import {
  ArrowLeft,
  Phone,
  Video,
  Users
} from "lucide-react";

import Avatar from "../ui/Avatar";

export default function ChatHeader({
  conversation,
  connected,
  onBack,

  canCall = false,
  callDisabledReason = "",
  onStartCall,
  callStarting = false
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 md:px-7">

      {/* Conversation information */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} />
        </button>

        <Avatar label={conversation.name} />

        <div className="min-w-0">
          <h2 className="truncate font-semibold">
            {conversation.name}
          </h2>

          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected
                  ? "bg-emerald-500"
                  : "bg-amber-400"
              }`}
            />

            {connected
              ? "Real-time connected"
              : "Connecting…"}
          </div>
        </div>
      </div>

      {/* Call actions */}
      <div className="flex shrink-0 items-center gap-2">

        <button
          type="button"
          onClick={() => onStartCall?.("AUDIO")}
          disabled={!canCall || callStarting}
          title={
            canCall
              ? "Start audio call"
              : callDisabledReason
          }
          aria-label="Start audio call"
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-brand hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Phone size={18} />
        </button>

        <button
          type="button"
          onClick={() => onStartCall?.("VIDEO")}
          disabled={!canCall || callStarting}
          title={
            canCall
              ? "Start video call"
              : callDisabledReason
          }
          aria-label="Start video call"
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-brand hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Video size={18} />
        </button>

        <div className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:flex">
          <Users size={14} />
          ID {conversation.id}
        </div>
      </div>
    </header>
  );
}
