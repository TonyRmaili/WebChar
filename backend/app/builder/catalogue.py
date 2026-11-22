"""The catalogues as the builder reads them: the books' entries plus the
user's public and private homebrew, one record per id (private wins over
public, public over the books), loaded once per category.

Uses the same loaders as routers/catalogues.py, so the builder and the
Catalogue pages always see the same records. Tests pass their own
`loader(category) -> [records]` instead.
"""


def _default_loader(username):
    from app.routers.catalogues import load_final, load_homebrew

    def load(category):
        try:
            books = load_final(category)
        except FileNotFoundError:
            books = []
        return books + load_homebrew("public", username, category) + load_homebrew("private", username, category)

    return load


class Catalogue:
    CATEGORIES = ("races", "backgrounds", "feats", "classes", "subclasses", "spells", "items", "optionalfeatures")

    def __init__(self, username=None, loader=None):
        self._load = loader or _default_loader(username)
        self._by_id = {}

    def _index(self, category):
        if category not in self._by_id:
            index = {}
            for rec in self._load(category) or []:
                if isinstance(rec, dict) and rec.get("id"):
                    index[rec["id"]] = rec  # later lists (homebrew) win
            self._by_id[category] = index
        return self._by_id[category]

    def get(self, category, rec_id):
        return self._index(category).get(rec_id)

    def all(self, category):
        return list(self._index(category).values())

    # ── lookups the builder needs ──

    def race_and_subrace(self, race_id, subrace_id=None):
        race = self.get("races", race_id)
        sub = next((s for s in (race or {}).get("subraces") or [] if s.get("id") == subrace_id), None) if subrace_id else None
        return race, sub

    def subclasses_of(self, class_id):
        return [s for s in self.all("subclasses") if s.get("class_id") == class_id]

    def feature(self, owner, feature_id):
        """A class or subclass feature by id, from the record that owns it."""
        return next((f for f in (owner or {}).get("features") or [] if f.get("id") == feature_id), None)

    def spells_matching(self, spell_filter):
        """Spells for a pool's `from` filter: spell_level, class (a class
        name like "wizard" or a class id), school, ritual, source."""
        f = spell_filter or {}
        levels = f.get("spell_level")
        levels = levels if isinstance(levels, list) else ([levels] if levels is not None else None)
        cls = f.get("class")
        classes = [str(c).lower() for c in cls] if isinstance(cls, list) else ([str(cls).lower()] if cls else [])
        out = []
        for sp in self.all("spells"):
            if levels is not None and sp.get("level") not in levels:
                continue
            if classes and not any(c in classes or str(c).split("-")[0] in classes for c in sp.get("classes") or []):
                continue
            if f.get("school") and sp.get("school") not in (f["school"] if isinstance(f["school"], list) else [f["school"]]):
                continue
            if f.get("ritual") and not sp.get("ritual"):
                continue
            if f.get("source") and str(sp.get("source", "")).lower() != str(f["source"]).lower():
                continue
            out.append(sp)
        return out

    def feats_matching(self, feat_filter):
        cats = (feat_filter or {}).get("category")
        cats = cats if isinstance(cats, list) else ([cats] if cats else None)
        return [ft for ft in self.all("feats") if cats is None or ft.get("category") in cats]
