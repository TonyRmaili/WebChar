import json

file_path = './app/database/save_files/new\\garry.json'
with open(file_path,'r') as f:
    file = json.load(f)

print(file)