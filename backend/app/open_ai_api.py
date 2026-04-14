from openai import OpenAI
from dotenv import load_dotenv
import os


class OpenAIApi:
    def __init__(self):
        # AI config
        load_dotenv(override=True)
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(
            api_key=self.api_key
        )
        self.model = "gpt-5-mini"
        self.reasoning = {"effort" : f""}

    
    def chat(self, messages, instructions, reasoning="low"):
        response = self.client.responses.create(
            model=self.model,
            input=messages,
            reasoning={"effort": reasoning},
            instructions = instructions   
        )

        return response.output_text

    
    def parse(self,chat_input,instructions,reasoning,text_format):
        input = [
            {"role": "system", "content": instructions},
            {"role": "user", "content": chat_input}  
        ]

        self.reasoning["effort"] = reasoning
        
        response = self.client.responses.parse(
            model=self.model,
            input=input,
            reasoning=self.reasoning,
            text_format=text_format
        )
        parsed = response.output_parsed
        
        if text_format:
            try:
                return parsed.model_dump()      
            except AttributeError:
                return parsed    

        else:
            return parsed


if __name__== "__main__":
    pass



