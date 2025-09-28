"use client";
import { useEffect } from "react";

export default function TelegramWebAppAuth() {
  useEffect(() => {
    try {
      const w = window as any;
      const wa = w?.Telegram?.WebApp;
      const user = wa?.initDataUnsafe?.user;
      if (user && user.id) {
        const newVal = String(user.id);
        const m = document.cookie.match(/(?:^|; )tg_user_id=([^;]+)/);
        const cur = m ? decodeURIComponent(m[1]) : undefined;
        if (cur !== newVal) {
          document.cookie = `tg_user_id=${encodeURIComponent(newVal)}; path=/; max-age=2592000`;
          // optional: expand webapp main button etc.
          try { wa?.ready?.(); } catch {}
          // reload to let server components pick cookie
          window.location.reload();
        }
      }
    } catch {}
  }, []);
  return null;
}
