import { LoaderCircle, X } from "lucide-react";
import FormField from "../auth/FormField";

export default function CreateConversationModal({
  open, onClose, name, onNameChange, memberId, onMemberChange, users, currentUserId, busy, onSubmit
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div><h3 className="text-lg font-bold">Create a conversation</h3><p className="mt-1 text-sm text-slate-400">Create it, then optionally add another user.</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <FormField label="Conversation name" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="e.g. Alex and Sam" />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Add a member (optional)</span>
            <select value={memberId} onChange={(event) => onMemberChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-brand">
              <option value="">Create with me only</option>
              {users.filter((user) => user.id !== currentUserId).map((user) => <option key={user.id} value={user.id}>{user.username} · ID {user.id}</option>)}
            </select>
          </label>
          <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">The current backend creates a conversation with you as its owner first. The selected user is added in a second request.</div>
          <button disabled={busy || !name.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
            {busy && <LoaderCircle size={16} className="animate-spin" />}Create conversation
          </button>
        </form>
      </div>
    </div>
  );
}