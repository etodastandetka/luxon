import ReferralLink from "../components/ReferralLink";
import { cookies } from "next/headers";

export default async function Page() {
  const base = process.env.NEXT_PUBLIC_DJANGO_BASE || 'http://localhost:8081';
  const ck = cookies();
  const userIdCookie = ck.get('tg_user_id')?.value;
  const userId = userIdCookie ? Number(userIdCookie) : undefined;
  const statsRes = userId
    ? await fetch(`${base}/bot/api/referral/stats/?user_id=${userId}`, { cache: 'no-store' }).catch(() => null)
    : null;
  const leaderboardRes = await fetch(`${base}/bot/api/referral/leaderboard/`, { cache: 'no-store' }).catch(() => null);

  const stats = statsRes && statsRes.ok ? await statsRes.json() : { success: false };
  const leaderboard = leaderboardRes && leaderboardRes.ok ? await leaderboardRes.json() : { success: false, items: [] };

  return (
    <main className="space-y-8">
      {/* Hero strip */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40">
        {/* floating ambient orbs */}
        <div className="orb orb-emerald float-1" style={{ width: 220, height: 220, top: -40, left: -60 }} />
        <div className="orb orb-cyan float-2" style={{ width: 260, height: 260, right: -80, top: -20 }} />
        <div className="absolute inset-0 opacity-60" style={{
          background:
            'radial-gradient(600px 200px at 10% 0%, rgba(34,197,94,0.18), transparent 60%),'+
            'radial-gradient(500px 200px at 90% 20%, rgba(94,234,212,0.15), transparent 60%)'
        }} />
        <div className="relative p-5 md:p-8 flex items-center gap-4 ring-anim rounded-xl">
          <div className="h-9 w-9 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center shadow-lg shadow-emerald-900/30 power-dot">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2v8" stroke="#001a0a" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="14" r="8" stroke="#001a0a" strokeWidth="2"/></svg>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold brand lux-gradient">Реферальный кабинет</h2>
            <p className="mt-1 text-slate-400 text-sm">Привлекай. Делись. Получай призы каждую неделю.</p>
          </div>
          <div className="ml-auto">
            <a href="/withdraw" className="text-sm px-4 py-2 rounded-lg border border-emerald-500/30 text-emerald-300">Вывод</a>
          </div>
        </div>
      </section>

      {/* Auth gate (WebApp only) */}
      {!userId ? (
        <section className="card">
          <h3 className="text-lg font-semibold">Откройте в Telegram</h3>
          <p className="hint mt-1">Мини‑приложение должно быть открыто внутри Telegram, чтобы мы получили ваш user_id автоматически.</p>
        </section>
      ) : null}

      {/* Profile */}
      <section className="card">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <h3 className="text-lg font-semibold">Профиль</h3>
        </div>
        {userId && stats.success ? (
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3">
                <div className="hint">ID</div>
                <div className="mt-1 font-medium">{stats.user.user_id}</div>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3">
                <div className="hint">Username</div>
                <div className="mt-1 font-medium">@{stats.user.username}</div>
              </div>
            </div>

            {/* 4 metric cards, 2 per row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <div className="hint">Активные рефералы</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-300">{stats.stats.active_referrals}</div>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <div className="hint">Начислено всего</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-300">{stats.stats.balance} KGS</div>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <div className="hint">В ожидании</div>
                <div className="mt-1 text-2xl font-semibold">{stats.stats.pending_withdrawals} KGS</div>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <div className="hint">Доступно к выводу</div>
                <div className="mt-1 text-2xl font-semibold">{stats.stats.available_balance} KGS</div>
              </div>
            </div>

            {/* Referral link */}
            <div>
              <div className="hint mb-1">Реф. ссылка</div>
              <ReferralLink href={stats.referral_link} />
            </div>

            <div className="hint">Ежемесячные призы: 1 место — 10 000 KGS, 2 место — 5 000 KGS, 3 место — 2 500 KGS.</div>
          </div>
        ) : !userId ? (
          <div className="text-sm text-slate-400">Откройте мини‑приложение внутри Telegram для загрузки данных.</div>
        ) : (
          <div className="text-sm text-slate-400">Нет данных. Убедитесь, что Django запущен на {base}.</div>
        )}
      </section>

      {/* Leaderboard */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Топ-3 за неделю</h3>
          {leaderboard.success && leaderboard.items.length > 0 ? (
            <a href="/withdraw" className="text-emerald-300">Вывести →</a>
          ) : null}
        </div>
        <div className="space-y-2">
          {leaderboard.success && leaderboard.items.length > 0 ? (
            leaderboard.items.map((it: any) => (
              <div key={it.position} className="flex items-center justify-between text-sm rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-6 h-6 items-center justify-center rounded-md bg-emerald-600/20 text-emerald-300">{it.position}</span>
                  <span>@{it.username}</span>
                  <span className="hint">активных: {it.active_referrals}</span>
                </div>
                <div className="hint">приз: {it.prize} KGS</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400">Нет данных рейтинга.</div>
          )}
        </div>
      </section>
    </main>
  );
}
