import requests
import json
import os
from dotenv import load_dotenv


load_dotenv(override=True)
WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")


path = os.path.join("../../AIdata","5etools_data","cleaned","monsters","mm2025_plusRE","Bat.json")

with open(path, "rb") as f:
    files = {
        "file": (path, f, "application/json")  # (filename, fileobj, mimetype)
    }
    data = {
        "content": "Medans ni funderar, checka in denna monster, vill ni ha den?"
    }
    resp = requests.post(WEBHOOK_URL, data=data, files=files)

# data = {
#     "content": "@cel @nooro @pimmu @Hanzibarrru"
# }

user_ids = {
    "hanzi":"371609071411003403",
    "cel":"187491311601844233",
    "nooro":"306115761817255946",
    "pimmu":"237261916307718144"
}


print(resp.status_code, resp.text)

mentions = " ".join(f"<@{uid}>" for uid in user_ids.values())

payload = {
    "content": f"{mentions} "
}
 

# response = requests.post(WEBHOOK_URL, json=data,files=)
# print(response.status_code, response.text)