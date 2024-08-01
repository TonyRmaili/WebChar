from IPython.display import Image, display, Audio, Markdown
import base64
from openai import OpenAI 
import os
from dotenv import load_dotenv

load_dotenv()

## Set the API key and model name
MODEL="gpt-4o-mini"
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

IMAGE_PATH = "./images/bronto.jpg"

# Preview image for context
display(Image(IMAGE_PATH))


# Open the image file and encode it as a base64 string
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

base64_image = encode_image(IMAGE_PATH)

# with path
# response = client.chat.completions.create(
#     model=MODEL,
#     messages=[
#         {"role": "system", "content": "You are an image classifier."},
#         {"role": "user", "content": [
#             {"type": "text", "text": "What animal is this?"},
#             {"type": "image_url", "image_url": {
#                 "url": f"data:image/png;base64,{base64_image}"}
#             }
#         ]}
#     ],
#     temperature=0.0,
# )

# with url
response = client.chat.completions.create(
    model=MODEL,
    messages=[
        {"role": "system", "content": "You are a helpful assistant that responds in Markdown. Help me with my math homework!"},
        {"role": "user", "content": [
            {"type": "text", "text": "What's the area of the triangle?"},
            {"type": "image_url", "image_url": {
                "url": "https://upload.wikimedia.org/wikipedia/commons/e/e2/The_Algebra_of_Mohammed_Ben_Musa_-_page_82b.png"}
            }
        ]}
    ],
    temperature=0.0,
)




print(response.choices[0].message.content)
