

import requests
from app.file_handler import FileHandler



response = requests.api.get(
    url="https://api.open5e.com/v2/creatures/",


)

data = response.json()["results"]


FileHandler().save_json("app/data_cleaning/monsters",data)
