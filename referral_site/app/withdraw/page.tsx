"use client";
import { useEffect, useState } from "react";

const BOOKMAKERS = [
  { value: "1xbet", label: "1XBET" },
  { value: "1win", label: "1WIN" },
  { value: "melbet", label: "MELBET" },
  { value: "mostbet", label: "MOSTBET" },
];

interface PaymentSettings {
  deposits: {
    enabled: boolean;
    banks: Array<{
      code: string;
      name: string;
      logo: string;
    }>;
  };
  withdrawals: {
    enabled: boolean;
    banks: Array<{
      code: string;
      name: string;
      logo: string;
    }>;
  };
}

export default function WithdrawPage() {
  const base = process.env.NEXT_PUBLIC_DJANGO_BASE || "http://localhost:8081";
  const [userId, setUserId] = useState<number | null>(null);
  const [bookmaker, setBookmaker] = useState("1xbet");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<number>(0);
  const [pending, setPending] = useState<number>(0);
  const [loadingBal, setLoadingBal] = useState<boolean>(true);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Загрузка настроек платежей
  useEffect(() => {
    let alive = true;
    async function loadSettings() {
      setLoadingSettings(true);
      try {
        const res = await fetch(`${base}/bot/api/payment-settings/`, { cache: 'no-store' });
        const data = await res.json();
        if (alive && data) {
          setPaymentSettings(data);
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек платежей:', error);
      }
      if (alive) setLoadingSettings(false);
    }
    loadSettings();
    return () => { alive = false; };
  }, [base]);

  // Read user_id from cookie set by Telegram WebApp (or fallback widget)
  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )tg_user_id=([^;]+)/);
      const v = m ? decodeURIComponent(m[1]) : '';
      const n = v && !isNaN(Number(v)) ? Number(v) : null;
      if (n && n !== userId) setUserId(n);
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoadingBal(true);
      try {
        if (userId) {
          const res = await fetch(`${base}/bot/api/referral/stats/?user_id=${userId}`, { cache: 'no-store' });
          const j = await res.json();
          if (alive && j && j.success) {
            setAvailable(Number(j.stats?.available_balance || 0));
            setPending(Number(j.stats?.pending_withdrawals || 0));
          }
        }
      } catch {}
      if (alive) setLoadingBal(false);
    }
    load();
    return () => { alive = false; };
  }, [base, userId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    const payload = {
      user_id: userId,
      username: "",
      first_name: "",
      last_name: "",
      amount: Number(amount || 0),
      currency: "KGS",
      bookmaker,
      bookmaker_account_id: accountId,
      payment_method: "e_wallet",
      wallet_details: accountId || "account_id",
    };

    try {
      setLoading(true);
      const val = Number(amount || 0);
      if (!(isFinite(val) && val > 0)) {
        setErr("Введите корректную сумму (> 0)");
        setLoading(false);
        return;
      }
      if (!userId) {
        setErr("Нет user_id. Откройте мини-приложение в Telegram.");
        setLoading(false);
        return;
      }
      if (isFinite(available) && val > available + 1e-6) {
        setErr("Сумма превышает доступный баланс");
        setLoading(false);
        return;
      }
      const res = await fetch(`${base}/bot/api/referral/withdraw/create/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) {
        setMsg("Заявка отправлена. Ожидайте подтверждения.");
        setAmount("");
        setAccountId("");
      } else {
        setErr(j.message || "Ошибка при отправке заявки");
      }
    } catch (error) {
      setErr("Ошибка сети. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-8">
      {/* Hero header for withdrawal */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40">
        <div className="orb orb-emerald float-1" style={{ width: 180, height: 180, top: -30, left: -40 }} />
        <div className="orb orb-cyan float-2" style={{ width: 220, height: 220, right: -60, top: -10 }} />
        <div className="relative p-5 md:p-7 ring-anim rounded-xl flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center power-dot">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2v8" stroke="#001a0a" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="14" r="8" stroke="#001a0a" strokeWidth="2"/></svg>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-semibold">Вывод средств</h2>
            <p className="hint mt-1">Средства будут зачислены на указанный аккаунт букмекера после подтверждения.</p>
          </div>
        </div>
      </section>

      {/* Проверка настроек выводов */}
      {loadingSettings ? (
        <section className="card">
          <div className="text-center py-8">
            <div className="text-slate-400">Загрузка настроек...</div>
          </div>
        </section>
      ) : paymentSettings && !paymentSettings.withdrawals.enabled ? (
        <section className="card">
          <div className="text-center py-8">
            <div className="text-orange-300 text-lg font-semibold mb-2">🔧 Технические работы</div>
            <div className="text-slate-400">Вывод средств временно недоступен. Попробуйте позже.</div>
          </div>
        </section>
      ) : (
        /* Form card */
        <section className="card">
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 max-w-lg">
            <div>
              <label className="block text-sm mb-2">Букмекер</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BOOKMAKERS.map((b) => {
                  const active = bookmaker === b.value;
                  return (
                    <button
                      type="button"
                      key={b.value}
                      onClick={() => setBookmaker(b.value)}
                      className={[
                        "relative rounded-xl px-3 py-3 text-sm border transition",
                        active
                          ? "border-emerald-500/60 bg-emerald-900/10 shadow-[0_0_0_1px_rgba(16,185,129,0.25)_inset]"
                          : "border-slate-700 bg-slate-900 hover:border-emerald-600/40"
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      <span className="block font-medium tracking-wide">{b.label}</span>
                      <span className="hint">{b.value.toUpperCase()}</span>
                      {active && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--accent)]"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">ID аккаунта</label>
              <div className="flex items-center gap-2">
                <div className="px-2 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-400">#</div>
                <input className="flex-1" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Напр. 123456789" />
              </div>
              <div className="hint mt-1">Укажите ID в личном кабинете букмекера.</div>
            </div>

            <div>
              <label className="block text-sm mb-1">Сумма, KGS</label>
              <div className="flex items-center gap-2">
                <div className="px-2 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-400">KGS</div>
                <input className="flex-1" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" max={isFinite(available) ? available : undefined} placeholder="Напр. 1500" />
              </div>
              <div className="hint mt-1">
                {loadingBal ? "Загрузка баланса..." : (
                  <>
                    Доступно к выводу: <b>{available}</b> KGS {pending>0 && (<span>(в ожидании: {pending} KGS)</span>)}
                  </>
                )}
              </div>
            </div>

            <div className="mt-2">
              <button className="w-full md:w-auto" type="submit" disabled={loading || loadingBal || !accountId || !amount}>Отправить</button>
              {loading && <span className="hint ml-3">Отправка…</span>}
            </div>

            {msg && <div className="text-emerald-300 text-sm border border-emerald-700/40 rounded-lg bg-emerald-900/10 px-3 py-2">{msg}</div>}
            {err && <div className="text-red-300 text-sm border border-red-800/40 rounded-lg bg-red-900/20 px-3 py-2">{err}</div>}
          </form>
        </section>
      )}
    </main>
  );
}
