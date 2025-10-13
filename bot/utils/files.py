import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


async def download_telegram_file_locally(bot, file_id: str, bot_token: str) -> str | None:
    """Download Telegram file by file_id and save under media/receipts/, return local URL (/media/...) or Telegram URL fallback.

    Returns:
        str: '/media/receipts/<filename>' or Telegram file URL on failure, or None if file_id missing.
    """
    if not file_id:
        return None
    try:
        file_info = await bot.get_file(file_id)
        fpath = getattr(file_info, 'file_path', None)
        if not fpath:
            return None

        tg_url = f"https://api.telegram.org/file/bot{bot_token}/{fpath}"
        try:
            import requests

            project_root = Path(__file__).resolve().parents[2]
            save_dir = project_root / 'media' / 'receipts'
            save_dir.mkdir(parents=True, exist_ok=True)

            ext = Path(fpath).suffix or '.jpg'
            safe_name = f"{int(datetime.now().timestamp())}_{file_id}{ext}"
            save_path = save_dir / safe_name

            r = requests.get(tg_url, stream=True, timeout=15)
            if r.status_code == 200:
                with open(save_path, 'wb') as fh:
                    for chunk in r.iter_content(1024 * 8):
                        if chunk:
                            fh.write(chunk)
                # Return web-accessible path
                return f"/media/receipts/{safe_name}"
            else:
                logger.warning(f"Failed to download telegram file {file_id}, status {r.status_code}")
                return tg_url
        except Exception as e:
            logger.warning(f"Error saving telegram file locally: {e}")
            return tg_url
    except Exception as e:
        logger.warning(f"Cannot get file info from Telegram for {file_id}: {e}")
        return None
