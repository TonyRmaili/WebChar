## Category: feats

`kind` is `feat` or `option` (one option of a feat, e.g. Magic Initiate's Cleric option).

- No features for blocks that only state whether the feat can be taken more than once ("Repeatable"), or only state a prerequisite.
- **Options:** make features only from the option's own `text`.
  - `race` holds the feat's name, and `race_blocks` lists the names of the feat's blocks. They are context only: never make features for them.
  - `parent_text`: the feat's own text. These are rules shared by every option, such as the save DC or how many uses there are. Use them to fill in numbers (e.g. a save DC), but never make features from them. A pool of uses described there belongs to the feat, so don't give the option's features those uses again.
