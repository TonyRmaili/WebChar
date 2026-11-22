import os
from ..text_renderer import render
from app.file_handler import FileHandler


RESOLVED_PATH = "app/data_cleaning/resolved/"
CLEANED_PATH = "app/data_cleaning/final/"

REMOVE_KEYS = [
    "page",
    "_file",
    "reprintedAs",
    "hasFluffImages"
]

filehandler = FileHandler()

loadpath = os.path.join(RESOLVED_PATH,"actions")
data = filehandler.load_json(loadpath)
data = data["action"]


for action in data:
    entries = action.pop("entries",None)
    if entries:
        action["text"] = render(entries)

    for key in list(action.keys()):
        if key in REMOVE_KEYS:
            action.pop(key)


savepath = os.path.join(CLEANED_PATH,"actions")
filehandler.save_json(savepath,data)
