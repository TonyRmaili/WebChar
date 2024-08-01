from pdf_handler import PdfHandler
from xembedder import Embedder
from dotenv import load_dotenv
from openai import OpenAI
import os


class Summarizer:
    def __init__(self,quary,model="gpt-4o-mini",
                 temperature=1,max_tokens=240,top_p=1,
                 frequency_penalty =0, presence_penalty=0
                 ) -> None:

        load_dotenv()
        self.client = OpenAI(
            api_key= os.getenv("OPENAI_API_KEY")
        )

        # resonse parameters
        self.model = model
        self.temp = temperature
        self.max_tokens = max_tokens
        self.freq_pen = frequency_penalty
        self.presence_pen = presence_penalty
        self.top_p=top_p

        # roles
        self.assistant_role = "You are a game rule interpreter"

        # paths
        self.summary_path = "./summaries/"

        self.quary = quary
        self.messages = [
            {"role":"system","content":self.assistant_role},
            {"role":"user","content":self.quary}
        ]



    def get_summary(self):

        '''
        quary format example (messages)
           
        messages=[
            {"role": "system", "content": "You are a helpful assistant that responds in Markdown. Help me with my math homework!"},
            {"role": "user", "content": [
                {"type": "text", "text": "What's the area of the triangle?"},
                {"type": "image_url", "image_url": {
                    "url": "https://upload.wikimedia.org/wikipedia/commons/e/e2/The_Algebra_of_Mohammed_Ben_Musa_-_page_82b.png"}
                }
            ]}
        ],

        '''

        response = self.client.chat.completions.create(

            model=self.model,
            messages=self.messages,
            temperature=self.temp,
            max_tokens=self.max_tokens,
            top_p=self.top_p,
            frequency_penalty=self.freq_pen,
            presence_penalty=self.presence_pen
        )
        response =response.choices[0].message.content
        return response
    


if __name__ == "__main__":

    pdf = PdfHandler()

    