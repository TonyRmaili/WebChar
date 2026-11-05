from openai import OpenAI
from dotenv import load_dotenv
import os
from pathlib import Path
from pydantic import ValidationError
from app.file_handler import FileHandler

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

    def file_divider(self,file_name):
        return f"\n## File: {file_name}\n"

    def extend_instructions(self, instructions,files) -> str:
        file_handler = FileHandler()
        extended_inst = instructions

        for file_path in files:
            data = file_handler.load_md(file_path)     
            file_name = Path(file_path).stem
            divider = self.file_divider(file_name)
            extended_inst += divider + data
            
        return extended_inst

    def chat(self, messages, instructions, reasoning="low"):
        response = self.client.responses.create(
            model=self.model,
            input=messages,
            reasoning={"effort": reasoning},
            instructions = instructions
        )

        return response.output_text

      
    def parse(self,instructions,input,reasoning,text_format,timeout=None):
        self.reasoning["effort"] = reasoning

        try:
            response = self.client.responses.parse(
                model=self.model,
                input=input,
                instructions=instructions,
                reasoning=self.reasoning,
                text_format=text_format,
                timeout=timeout,
                
            )

        except ValidationError as e:
            print("ValidationError during OpenAI parse:")
            print(e)

            return {
                "parse_error": True,
                "error_type": "ValidationError",
                "error": str(e),
                "raw_response": None
            }

        parsed = response.output_parsed
        total_tokens = response.usage.total_tokens
        
        if text_format:
            try:
                return parsed.model_dump(by_alias=True) , total_tokens    
            except AttributeError:
                return parsed , total_tokens

            
        else:
            return parsed , total_tokens
        

    def chat_log(self,instructions,files,messages):
        instructions = self.extend_instructions(instructions,files)
        response = self.chat(
            messages= messages,
            instructions= instructions,
            reasoning="low"
        )

        return response


if __name__== "__main__":
    pass



