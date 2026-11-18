
import { LogOut, Plus, Search, UserRound } from "lucide-react";
import Avatar from "../ui/Avatar";

export default function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onLogout,
  search,
  onSearch,
  currentUserId
}) {
  const filtered = conversations.filter((item) =>
    `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-slate-100 md:w-[330px] lg:w-[360px]">
      <div className="flex items-center justify-between px-5 pb-4 pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            HushTalk
          </p>
          <h1 className="mt-1 text-2xl font-bold">Messages</h1>
        </div>

        <button
          onClick={onCreate}
          title="Create conversation"
          className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white hover:bg-indigo-600"
        >
          <Plus size={19} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-slate-400">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search conversations"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Your conversations
        </div>

        {filtered.map((conversation) => {
          const lastMessage = conversation.lastMessage;

          const isOwnLastMessage =
            lastMessage &&
            Number(lastMessage.senderId) === Number(currentUserId);

          const preview = lastMessage
            ? `${isOwnLastMessage ? "You: " : ""}${lastMessage.content || "Message"}`
            : `Conversation #${conversation.id}`;

          const unreadCount = Number(conversation.unreadCount || 0);

          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation)}
              className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                selectedId === conversation.id
                  ? "bg-brand-soft"
                  : "hover:bg-slate-50"
              }`}
            >
              <Avatar label={conversation.name} />

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {conversation.name}
                </div>

                <div
                  className={`mt-1 truncate text-xs ${
                    unreadCount > 0
                      ? "font-semibold text-ink"
                      : "text-slate-400"
                  }`}
                >
                  {preview}
                </div>
              </div>

              {unreadCount > 0 ? (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : selectedId === conversation.id ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
              ) : null}
            </button>
          );
        })}

        {!filtered.length && (
          <div className="px-3 py-8 text-center text-sm text-slate-400">
            No conversations found.
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500">
            <UserRound size={17} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Signed in</p>
            <p className="text-xs text-slate-400">
              User ID: {currentUserId ?? "—"}
            </p>
          </div>

          <button
            onClick={onLogout}
            title="Sign out"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
