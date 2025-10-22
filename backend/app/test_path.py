import os

fiveEtools_path = os.path.join(os.path.dirname(__file__), "../data/5etools_data/spells")

# normalize to absolute path
path = os.path.abspath(fiveEtools_path)

filenames = [
    os.path.splitext(f)[0]
    for f in os.listdir(path)
    if os.path.isfile(os.path.join(path, f))
]

print(filenames)
