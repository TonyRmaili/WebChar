from app.routers.campaigns import TABLES_DIR
from app.routers.scoped import scoped_router


# ---------- tables ----------
# Tables to roll on with real dice: a die, and rows that each cover a range
# of it (claude/tables-contract.md). Rows point at things (catalogue items,
# encounters, other tables) by reference, never by copy. Kept in one
# campaign or in all of them — the endpoints are in scoped.py.

router = scoped_router("/tables", TABLES_DIR, "That table", "New table")