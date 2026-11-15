"""The final shape of a background, as written by the code cleaner.

`text` and `features` are added later by the LLM step; the code part
leaves them out.
"""

from .common_schema import Choice, EntryHeader, Grants


class Background(EntryHeader):
    grants: Grants = Grants()
    choices: list[Choice] = []
