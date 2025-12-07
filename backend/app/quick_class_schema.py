from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class CharacterClass(BaseModel):
    """
    One D&D class entry.

    Example:
    {
        "name": "barbarian",
        "sub_class": "Berserker",
        "level": 4,
        "first_class": true
    }
    """

    name: str
    sub_class: Optional[str] = None
    level: int = Field(..., ge=1, le=20)
    first_class: bool

    class Config:
        extra = "ignore"   # ignore any extra keys the model might add


class QuickClassSchema(BaseModel):
    """
    Top-level schema for OpenAI response_format.

    Expected JSON from the model:

    {
      "classes": [
        {
          "name": "barbarian",
          "sub_class": "Berserker",
          "level": 4,
          "first_class": true
        },
        {
          "name": "bard",
          "sub_class": null,
          "level": 1,
          "first_class": false
        }
      ]
    }
    """

    classes: List[CharacterClass] = Field(default_factory=list)

    @model_validator(mode="after")
    def ensure_single_first_class(self) -> "QuickClassSchema":
        first_count = sum(1 for c in self.classes if c.first_class)
        if first_count != 1:
            raise ValueError(
                "Exactly one class in 'classes' must have first_class=True."
            )
        return self

    class Config:
        extra = "ignore"
