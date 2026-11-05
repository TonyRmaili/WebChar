from pydantic import BaseModel, Field
from typing import Literal

ItemType = Literal[
    "Spellcasting Focus", "Melee Weapon", "Instrument", "Rod", "Wand",
    "Adventuring Gear", "Trade Good", "Other", "Ring", "Vehicle", "Tool",
    "Treasure", "Shield", "Heavy Armor", "Mount", "Medium Armor", "Potion",
    "Explosive", "Gaming Set", "Ranged Weapon", "Light Armor", "Scroll",
    "Ammunition", "Tattoo", "Poison",
]

class CleanedGenericItem(BaseModel):
    types: list[ItemType] = Field(..., min_length=1)
    entries: str = Field(..., min_length=1)