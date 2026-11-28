"""The AI budget (2026-11-26): how many tokens a user's AI may spend a day.

save_files/<user>/ai.json:

    {"daily_limit": 50000,        # null = no limit
     "utc_offset": -60,           # the browser's clock, as JavaScript's getTimezoneOffset()
     "days": {"2026-11-26": {"words": 1234, "pictures": 4160}}}

A day is the user's own: it starts at midnight on their clock. The browser
sends its offset whenever it asks for the usage (the assistant panel and
Settings do), so summer / winter time follows along. The last 31 days are
kept.

Tokens are what OpenAI counts and bills: the words going in and out for the
assistant ("words"), the picture's tokens for the image model
("pictures"), and the notes search's embeddings ("search": notes when they
change, and each question). The limit is checked before a call; a call is never cut off
half way, so the last one of a day can go a little over.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException

from app.file_handler import FileHandler

SAVEFILES_PATH = "./app/database/save_files/"
KINDS = ("words", "pictures", "search")
KEEP_DAYS = 31


def _base(user_name: str) -> str:
    """save_files/<user>/ai (FileHandler adds the .json)."""
    folder = Path(SAVEFILES_PATH) / user_name
    folder.mkdir(parents=True, exist_ok=True)
    return str(folder / "ai")


def _load(user_name: str) -> dict:
    try:
        data = FileHandler().load_json(_base(user_name))
    except (OSError, ValueError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    data.setdefault("daily_limit", None)
    data.setdefault("utc_offset", 0)
    data.setdefault("days", {})
    return data


def _save(user_name: str, data: dict) -> None:
    days = data["days"]
    for old in sorted(days)[:-KEEP_DAYS]:
        del days[old]
    FileHandler().save_json(_base(user_name), data)


def _local_now(data: dict) -> datetime:
    # getTimezoneOffset is minutes *behind* UTC: Budapest in winter is -60.
    return datetime.now(timezone.utc) - timedelta(minutes=int(data.get("utc_offset") or 0))


def _today(data: dict) -> str:
    return _local_now(data).date().isoformat()


def usage(user_name: str) -> dict:
    """What today looks like: the limit, what's used (and by what), what's left,
    and the minutes until the day turns over."""
    data = _load(user_name)
    day = data["days"].get(_today(data), {})
    spent = {k: int(day.get(k, 0)) for k in KINDS}
    used = sum(spent.values())
    limit = data["daily_limit"]
    now = _local_now(data)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "daily_limit": limit,
        "used": used,
        **spent,
        "left": None if limit is None else max(0, limit - used),
        "resets_in_minutes": int((midnight - now).total_seconds() // 60) + 1,
    }


def check(user_name: str) -> None:
    """Before a call: stop if today's tokens are used up."""
    u = usage(user_name)
    if u["daily_limit"] is not None and u["used"] >= u["daily_limit"]:
        hours, minutes = divmod(u["resets_in_minutes"], 60)
        raise HTTPException(
            status_code=429,
            detail=f"Today's AI tokens are used up ({u['used']:,} of {u['daily_limit']:,}). "
            f"They come back at midnight, in {hours} h {minutes} min, or raise the limit in Settings.",
        )


def record(user_name: str, kind: str, tokens: int) -> None:
    """After a call: add what it spent to today."""
    if kind not in KINDS or not tokens:
        return
    data = _load(user_name)
    day = data["days"].setdefault(_today(data), {})
    day[kind] = int(day.get(kind, 0)) + int(tokens)
    _save(user_name, data)


def set_offset(user_name: str, utc_offset: int) -> None:
    data = _load(user_name)
    if data["utc_offset"] != utc_offset:
        data["utc_offset"] = utc_offset
        _save(user_name, data)


def set_limit(user_name: str, daily_limit: int | None) -> None:
    data = _load(user_name)
    data["daily_limit"] = daily_limit
    _save(user_name, data)
