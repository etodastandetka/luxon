"use client";
import React, { useEffect } from "react";

interface Props {
  botUsername?: string;
}

export default function TelegramLogin({ botUsername }: Props) {
  const username = botUsername || process.env.NEXT_PUBLIC_TG_BOT_USERNAME || "Lux_on_bot";
  const authUrl = "/api/tg-auth"; // Next API route

  useEffect(() => {
    // Inject Telegram login widget script
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", username);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-userpic", "false");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    // Fallback to auth-url if onaust not supported
    s.setAttribute("data-auth-url", authUrl);

    // Global handler required by widget
    (window as any).onTelegramAuth = function(user: any) {
      try {
        // Store minimal info; server will still verify on redirect
        document.cookie = `tg_user_id=${user.id}; path=/; max-age=2592000`;
        window.location.reload();
      } catch {}
    };

    document.getElementById("tg-login-container")?.appendChild(s);

    return () => {
      try {
        delete (window as any).onTelegramAuth;
      } catch {}
    };
  }, [username]);

  return (
    <div id="tg-login-container" className="mt-3" />
  );
}
