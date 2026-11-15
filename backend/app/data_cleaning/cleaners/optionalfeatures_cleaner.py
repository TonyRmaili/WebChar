"""Code cleaner for optional features: one resolved entry -> our shape.

    clean_optionalfeature(entry) -> (cleaned dict, problems)

All 233 stay in ONE file (cleaned/optionalfeatures.json); `feature_types`
says what each one is, so the frontend filters instead of opening
separate files.

Edition: optional features have no `edition` key; it comes from the data
(common_cleaner.edition_of: SRD flags, reprints, a 2024 class prerequisite,
the book's other entries, the book's publication date). Anything still
undecided is reported and left out (add it to patches/optionalfeatures.json).
"""

from pydantic import ValidationError

from ..schemas.common_schema import dump
from ..schemas.optionalfeatures_schema import OptionalFeature
from . import common_cleaner as c
from .feats_cleaner import prerequisites

HANDLED = {
    "name", "source", "edition", "srd", "srd52", "reprintedAs", "prerequisite", "featureType",
    "consumes", "additionalSpells", "skillProficiencies", "senses", "featProgression",
    "optionalfeatureProgression", "entries", "repeatable", "basicRules", "basicRules2024",
}
DROPPED = {"page", "hasFluffImages", "otherSources", "isClassFeatureVariant", "_file"}


def clean_optionalfeature(entry: dict) -> tuple[dict | None, list[str]]:
    problems: list[str] = []
    out = c.header(entry, "optional_feature", problems, read_prerequisite=False)
    edition = c.edition_of(entry, problems, "optionalfeatures")
    if edition is None:
        c.unhandled(entry, HANDLED, DROPPED, problems)
        return None, problems
    out["edition"] = edition

    flt = c.optional_feature_filter(entry.get("featureType", []), problems)
    out["feature_types"] = flt["feature_type"]
    if flt.get("class"):
        out["classes"] = flt["class"]

    cons = entry.get("consumes")
    if cons:
        out["consumes"] = {"resource": c.resource_id(cons.get("name", "")), "amount": cons.get("amount", 1)}
        if "amountMin" in cons or "amountMax" in cons:
            out["consumes"] = {"resource": out["consumes"]["resource"],
                               "min": cons.get("amountMin"), "max": cons.get("amountMax")}

    if entry.get("repeatable"):
        out["repeatable"] = True
    pre = prerequisites(entry.get("prerequisite"), problems)
    if pre:
        out["prerequisites"] = pre

    grants: dict = {}
    choices: list = []
    for g, ch in (
        c.proficiencies(entry.get("skillProficiencies"), "skills", problems),
        c.spells(entry.get("additionalSpells"), problems),
    ):
        c.add_grants(grants, g)
        choices += ch
    s = c.senses(entry.get("senses"), problems)
    if s:
        grants["senses"] = s
    choices += c.optional_features(entry.get("optionalfeatureProgression"), problems)
    choices += c.feat_progression(entry.get("featProgression"), problems)
    c.assign_ids(choices)
    out["grants"], out["choices"] = grants, choices

    c.unhandled(entry, HANDLED, DROPPED, problems)
    try:
        return dump(OptionalFeature.model_validate(out)), problems
    except ValidationError as e:
        problems += [f"schema: {'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        return None, problems
