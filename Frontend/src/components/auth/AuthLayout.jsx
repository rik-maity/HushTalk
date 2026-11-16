import { MessageCircle } from "lucide-react";

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-indigo-200">
            <MessageCircle size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">HushTalk</h1>
            <p className="text-sm text-muted">Conversations, in real time.</p>
          </div>
        </div>
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-slate-100 pt-5">{footer}</div>}
        </section>
        <p className="mt-5 text-center text-xs text-slate-400">HushTalk development build</p>
      </div>
    </main>
  );
}