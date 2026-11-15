"""Code cleaner for backgrounds: one resolved entry -> our shape (no LLM).

    clean_background(entry) -> (cleaned dict, problems)

Works on one entry at a time, so the Catalogue import button can use it too.
`text` and `features` are added later by the LLM step.
"""

from pydantic import ValidationError

from ..schemas.backgrounds_schema import Background
from ..schemas.common_schema import dump
from . import common_cleaner as c

HANDLED = {
    "name", "source", "edition", "srd", "srd52", "reprintedAs", "prerequisite",
    "ability", "skillProficiencies", "toolProficiencies", "languageProficiencies",
    "skillToolLanguageProficiencies", "feats", "additionalSpells", "startingEquipment",
    "entries",      # read by the LLM step
    "fromFeature",  # grants stay at top level, so this marker isn't needed
}
DROPPED = {"page", "hasFluff", "hasFluffImages", "basicRules", "basicRules2024",
           "otherSources", "additionalSources", "_file"}


def clean_background(entry: dict) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    out = c.header(entry, "background", problems)
    grants: dict = {}
    choices: list = []

    for g, ch in (
        c.ability_scores(entry.get("ability"), problems),
        c.proficiencies(entry.get("skillProficiencies"), "skills", problems),
        c.proficiencies(entry.get("toolProficiencies"), "tools", problems),
        c.proficiencies(entry.get("languageProficiencies"), "languages", problems),
        c.mixed_proficiencies(entry.get("skillToolLanguageProficiencies"), problems),
        c.feats(entry.get("feats"), problems),
        c.spells(entry.get("additionalSpells"), problems),
        c.equipment(entry.get("startingEquipment"), problems),
    ):
        c.add_grants(grants, g)
        choices += ch

    c.assign_ids(choices)
    out["grants"] = grants
    out["choices"] = choices
    c.unhandled(entry, HANDLED, DROPPED, problems)

    try:
        return dump(Background.model_validate(out)), problems
    except ValidationError as e:
        problems += [f"schema: {'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        return None, problems
