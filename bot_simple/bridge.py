#!/usr/bin/env python3
"""
Pyrogram bridge for user-account chat delivery.

Функции:
- Принимает входящие из личного аккаунта Telegram и отправляет в админку:
  - текст -> /api/users/{userId}/chat/ingest (JSON)
  - медиа -> /api/users/{userId}/chat/ingest-upload (multipart)
- Забирает исходящие из админки (outbox) и отправляет пользователю через аккаунт:
  - если BRIDGE_MODE=operator -> /api/operator-chat/outbox + ack
  - иначе -> /api/chat/outbox + ack

Переменные окружения:
  API_ID           — Telegram api_id
  API_HASH         — Telegram api_hash
  SESSION_STRING   — session_string личного аккаунта (export_session_string)
  API_BASE         — базовый URL админки, например https://japar.click
  OUTBOX_POLL_SEC  — интервал опроса аутбокса (сек), по умолчанию 2
  BRIDGE_MODE      — bot | operator (default bot)
"""
import asyncio
import mimetypes
import os
import tempfile
from typing import Optional, List

import httpx
from pyrogram import Client, filters
from pyrogram.types import Message


API_ID = int(os.environ.get("API_ID", "0"))
API_HASH = os.environ.get("API_HASH", "")
SESSION_STRING = os.environ.get("SESSION_STRING", "")
API_BASE = os.environ.get("API_BASE", "https://japar.click").rstrip("/")
OUTBOX_POLL_SEC = float(os.environ.get("OUTBOX_POLL_SEC", "2"))
BRIDGE_MODE = os.environ.get("BRIDGE_MODE", "bot")  # bot | operator

if not (API_ID and API_HASH and SESSION_STRING and API_BASE):
    raise RuntimeError("Set API_ID, API_HASH, SESSION_STRING, API_BASE env vars")

http = httpx.AsyncClient(timeout=15.0)
app = Client(
    "bridge-session",
    api_id=API_ID,
    api_hash=API_HASH,
    session_string=SESSION_STRING,
    in_memory=True,
)


async def send_ingest_text(user_id: int, text: str, telegram_message_id: int):
    payload = {
        "message_text": text,
        "message_type": "text",
        "telegram_message_id": telegram_message_id,
    }
    url = (
        f"{API_BASE}/api/users/{user_id}/chat/ingest"
        if BRIDGE_MODE == "bot"
        else f"{API_BASE}/api/operator-chat/ingest-upload/{user_id}"  # ingest-upload expects multipart; for text оставим ingest
    )
    r = await http.post(url, json=payload)
    if r.status_code >= 400:
        print(f"[ingest] failed {r.status_code}: {r.text[:200]}")


async def send_ingest_upload(
    user_id: int,
    file_path: str,
    message: Optional[str],
    mime: Optional[str],
    telegram_message_id: int,
):
    url = (
        f"{API_BASE}/api/users/{user_id}/chat/ingest-upload"
        if BRIDGE_MODE == "bot"
        else f"{API_BASE}/api/operator-chat/ingest-upload/{user_id}"
    )
    filename = os.path.basename(file_path)
    mime_type = mime or (mimetypes.guess_type(filename)[0] or "application/octet-stream")
    files = {"file": (filename, open(file_path, "rb"), mime_type)}
    data = {"message": message or "", "telegram_message_id": str(telegram_message_id)}
    try:
        r = await http.post(url, data=data, files=files)
        if r.status_code >= 400:
            print(f"[ingest-upload] failed {r.status_code}: {r.text[:200]}")
    finally:
        files["file"][1].close()


def detect_message_type(msg: Message) -> str:
    if msg.photo:
        return "photo"
    if msg.video:
        return "video"
    if msg.voice:
        return "voice"
    if msg.audio:
        return "audio"
    if msg.document:
        return "document"
    return "text"


async def handle_incoming(_: Client, msg: Message):
    if not msg.from_user:
        return
    user_id = msg.from_user.id
    tg_id = msg.id
    text = msg.text or msg.caption or ""
    mtype = detect_message_type(msg)

    # Текст без медиа
    if mtype == "text" and not (msg.photo or msg.video or msg.voice or msg.audio or msg.document):
        await send_ingest_text(user_id, text, tg_id)
        return

    # Медиа
    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = await msg.download(file_name=tmpdir)
        mime = None
        if msg.document and msg.document.mime_type:
            mime = msg.document.mime_type
        elif msg.audio and msg.audio.mime_type:
            mime = msg.audio.mime_type
        elif msg.video and msg.video.mime_type:
            mime = msg.video.mime_type
        elif msg.voice and msg.voice.mime_type:
            mime = msg.voice.mime_type
        await send_ingest_upload(user_id, file_path, text, mime, tg_id)


async def poll_outbox():
    while True:
        try:
            outboxUrl = (
                f"{API_BASE}/api/chat/outbox?limit=50&channel=bot"
                if BRIDGE_MODE == "bot"
                else f"{API_BASE}/api/operator-chat/outbox?limit=50"
            )
            r = await http.get(outboxUrl)
            if r.status_code != 200:
                print(f"[outbox] http {r.status_code}: {r.text[:200]}")
                await asyncio.sleep(OUTBOX_POLL_SEC)
                continue
            data = r.json()
            items: List[dict] = data.get("data", {}).get("messages", [])
            if not items:
                await asyncio.sleep(OUTBOX_POLL_SEC)
                continue

            ack_list = []
            for item in items:
                uid = int(item["userId"])
                mtype = item.get("messageType", "text")
                text = item.get("messageText") or ""
                media_url = item.get("mediaUrl")

                sent_msg = None
                try:
                    if mtype == "text":
                        sent_msg = await app.send_message(uid, text)
                    elif mtype == "photo" and media_url:
                        sent_msg = await app.send_photo(uid, media_url, caption=text or None)
                    elif mtype == "video" and media_url:
                        sent_msg = await app.send_video(uid, media_url, caption=text or None)
                    elif mtype in ("audio", "voice") and media_url:
                        if mtype == "voice":
                            sent_msg = await app.send_voice(uid, media_url, caption=text or None)
                        else:
                            sent_msg = await app.send_audio(uid, media_url, caption=text or None)
                    elif media_url:
                        sent_msg = await app.send_document(uid, media_url, caption=text or None)
                    else:
                        # fallback: send text if no media
                        sent_msg = await app.send_message(uid, text or "[no content]")
                except Exception as e:
                    print(f"[outbox] send failed for {uid}: {e}")
                    continue

                if sent_msg:
                    ack_list.append(
                        {
                          "id": item["id"],
                          "telegram_message_id": str(sent_msg.id),
                          "media_url": media_url,
                        }
                    )

            if ack_list:
                ackUrl = (
                    f"{API_BASE}/api/chat/outbox/ack"
                    if BRIDGE_MODE == "bot"
                    else f"{API_BASE}/api/operator-chat/outbox/ack"
                )
                ack_resp = await http.post(ackUrl, json={"messages": ack_list})
                if ack_resp.status_code >= 400:
                    print(f"[ack] failed {ack_resp.status_code}: {ack_resp.text[:200]}")
        except Exception as e:
            print(f"[outbox] loop error: {e}")
        await asyncio.sleep(OUTBOX_POLL_SEC)


async def main():
    # Запускаем клиента и обработчик входящих
    await app.start()
    app.add_handler(filters.private & ~filters.bot, handle_incoming)
    asyncio.create_task(poll_outbox())
    print("✅ Bridge started. Listening for messages...")
    await idle()


async def idle():
    # Простой idle цикл
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())

