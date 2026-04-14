from app.open_ai_api import OpenAIApi
from app.file_handler import FileHandler
from pathlib import Path


class ChatManager:
    def __init__(self):
        self.open_ai = OpenAIApi()

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


    def chat_log(self,instructions,files,messages):
        instructions = self.extend_instructions(instructions,files)
        response = self.open_ai.chat(
            messages= messages,
            instructions= instructions,
            reasoning="low"
        )

        return response


        


if __name__ == "__main__":
    pass