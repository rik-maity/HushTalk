import { LoaderCircle } from "lucide-react";

export default function AuthSubmitButton({ busy, children }) {
  return (
    <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60">
      {busy && <LoaderCircle className="animate-spin" size={17} />}
      {children}
    </button>
  );
}