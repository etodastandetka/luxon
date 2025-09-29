"use client";
import { useEffect } from "react";

function getCookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch { return undefined; }
}

function setTgCookieAndReload(val: string) {
  try {
    document.cookie = `tg_user_id=${encodeURIComponent(val)}; path=/; max-age=2592000`;
    // Reload so Next.js server components can see cookie on first render
    window.location.replace(window.location.pathname + window.location.search + window.location.hash);
  } catch {}
}

export default function TelegramWebAppAuth() {
  useEffect(() => {
    try {
      const existing = getCookie('tg_user_id');
      if (existing && existing.length > 0) return; // already set

      const w = window as any;
      const wa = w?.Telegram?.WebApp;
      const user = wa?.initDataUnsafe?.user;
      if (user?.id) {
        try { wa?.expand?.(); wa?.ready?.(); } catch {}
        const newVal = String(user.id);
        setTgCookieAndReload(newVal);
        return;
      }

      // Fallback: accept user id from URL (?uid= / ?user_id=) or hash (#uid=)
      try {
        const url = new URL(window.location.href);
        let cand: string | null | undefined = url.searchParams.get('uid') || url.searchParams.get('user_id');
        if (!cand && url.hash) {
          const hs = new URLSearchParams(url.hash.replace(/^#/, ''));
          cand = hs.get('uid') || hs.get('user_id') || undefined;
        }
        if (cand && /^\d+$/.test(cand)) {
          setTgCookieAndReload(cand);
          return;
        }
      } catch {}
    } catch {}
  }, []);
  return null;
}
