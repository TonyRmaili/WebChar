import json
import os

data = {
    "name": "John",
    "age": 30,
    "city": "New York"
}

def save_char_tojson(data,name,user_name):
    
# Define the directory path where you want to create the folder and script
    directory_path = "/database/save_files/"+user_name 
    file_name = name
    # Combine the directory path and file name to create the file path
    file_path = os.path.join(directory_path, file_name)

    # Create the directory if it doesn't exist
    os.makedirs(directory_path, exist_ok=True)
    with open(file_path, "w") as json_file:
        json.dump(data, json_file, indent=4)

