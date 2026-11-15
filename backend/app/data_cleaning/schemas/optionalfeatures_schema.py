"""The final shape of an optional feature (invocations, maneuvers, metamagic,
fighting styles, infusions, …), as written by the code cleaner.

`text` and `features` are added later by the LLM step.

feature_types  what kind it is, e.g. ["eldritch_invocation"]
classes        whose list it is on, when the type is shared (fighting styles:
               ["fighter", "ranger"])
consumes       what using it costs from a class resource, e.g.
               {"resource": "superiority_die", "amount": 1}; "min"/"max" when
               the player chooses how much (1-9 sorcery points)
repeatable     can be taken more than once (some 2024 invocations)
prerequisites  same shape as feats (see schemas/feats_schema.py)
"""

from typing import Literal

from .common_schema import Choice, EntryHeader, Grants, Strict
from .feats_schema import Prerequisite

FeatureType = Literal[
    "eldritch_invocation", "maneuver", "metamagic", "elemental_discipline", "artificer_infusion",
    "arcane_shot", "rune", "renown_perk", "pact_boon", "fighting_style",
]


class Consumes(Strict):
    resource: str
    amount: int | None = None
    min: int | None = None
    max: int | None = None


class OptionalFeature(EntryHeader):
    feature_types: list[FeatureType]
    classes: list[str] | None = None
    consumes: Consumes | None = None
    repeatable: bool = False
    prerequisites: list[Prerequisite] | None = None
    grants: Grants = Grants()
    choices: list[Choice] = []
