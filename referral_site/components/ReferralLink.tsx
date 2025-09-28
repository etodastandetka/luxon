type Props = { href: string };

export default function ReferralLink({ href }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <a
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 hover:border-emerald-600/50 transition overflow-hidden"
        href={href}
        target="_blank"
        rel="noreferrer"
        title={href}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10 14a5 5 0 0 1 0-7l1-1a5 5 0 1 1 7 7l-1 1" stroke="#22c55e" strokeWidth="2"/></svg>
        <span className="truncate">{href}</span>
      </a>
      <div className="hint">Открой ссылку в Telegram и запусти бота по ссылке.</div>
    </div>
  );
}
