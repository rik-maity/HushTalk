import { ArrowLeft, Users } from "lucide-react";
import Avatar from "../ui/Avatar";

export default function ChatHeader({ conversation, connected, onBack }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"><ArrowLeft size={18} /></button>
        <Avatar label={conversation.name} />
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{conversation.name}</h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-400"}`} />
            {connected ? "Real-time connected" : "Connecting…"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs text-slate-500"><Users size={14} /> ID {conversation.id}</div>
    </header>
  );
}