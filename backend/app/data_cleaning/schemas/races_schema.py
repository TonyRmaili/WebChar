"""The final shape of a race and its subraces, as written by the code cleaner.

`text` and `features` are added later by the LLM step.

A race with subraces needs one of them picked. A subrace only holds what it
adds or changes:
  replaces       race grants this subrace replaces instead of adding to
                 (e.g. ["ability"]: use the subrace's bonuses, not the race's)
  replaces_text  race text blocks this subrace's text replaces (by name)
"""

from typing import Literal

from .common_schema import Choice, EntryHeader, Grants

Size = Literal["tiny", "small", "medium", "large", "huge", "gargantuan", "varies"]


class Subrace(EntryHeader):
    size: list[Size] | None = None
    grants: Grants = Grants()
    choices: list[Choice] = []
    replaces: list[str] | None = None
    replaces_text: list[str] | None = None


class Race(EntryHeader):
    size: list[Size]
    creature_types: list[str] = ["humanoid"]
    grants: Grants = Grants()
    choices: list[Choice] = []
    subraces: list[Subrace] | None = None
