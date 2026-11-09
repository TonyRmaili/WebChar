from app.routers.campaigns import TEMPLATES_DIR
from app.routers.scoped import scoped_router


# ---------- templates ----------
# A template is a "statblock without a creature" that is laid on top of
# monsters and NPCs (claude/templates-contract.md). Kept in one campaign or
# in all of them — the endpoints are in scoped.py.

router = scoped_router("/templates", TEMPLATES_DIR, "That template", "New template")