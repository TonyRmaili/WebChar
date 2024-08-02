import fitz 
import json
import os


class PdfHandler:
    def __init__(self,pdf_name):
        self.pdf_name = self.remove_extension(pdf_name)

        self.game_rules_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "game_rules/")
        self.chunks_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdf_chunks/")
        self.pdf_path = os.path.join(self.game_rules_path, self.pdf_name)

        # self.game_rules_path = "./game_rules/"
        # self.chunks_path = "./pdf_chunks/"
        # self.pdf_path = self.game_rules_path+self.pdf_name
        
        self.chunk_size = 600
        self.overlap = 100


    def remove_extension(self,file_name):
        base_name, _ = os.path.splitext(file_name)
        return base_name

    def extract_pages(self )->list:
        document = fitz.open(self.pdf_path+".pdf")
        all_pages = []
        for page_num in range(document.page_count):
            page = document.load_page(page_num)
            text = page.get_text("text")
            all_pages.append({"text":text, "page_num":(page_num+1)})
        return all_pages
    
    def chunk_pages(self,all_pages )->list:
        chunked_pages = []
        carry_over = []
        start_page = None
        end_page = None

        for data in all_pages:
            words = carry_over + data["text"].split()  # Include carry_over from previous page
            current_page_num = data["page_num"]
            start = 0

            if start_page is None:
                start_page = current_page_num  # Initialize start_page

            while start < len(words):
                end = min(start + self.chunk_size, len(words))

                chunk = ' '.join(words[start:end])
                end_page = current_page_num  # Update end_page to the current page number
                page_nums = (start_page, end_page) if start_page != end_page else (start_page,)
                chunked_pages.append({"chunk": chunk, "page_nums": page_nums})

                start += (self.chunk_size - self.overlap)

                # If end reaches the length of words, we prepare the carry_over for the next page
                if end == len(words):
                    carry_over = words[start:]
                    start_page = start_page if carry_over else None  # Keep start_page if there's carry_over
                    break

            if start >= len(words):
                carry_over = []
                start_page = None  # Reset start_page if no carry_over

        # Handle any remaining carry_over after the last page
        if carry_over:
            chunked_pages.append({"chunk": ' '.join(carry_over), "page_nums": (start_page, end_page)})

        return chunked_pages
    
    def save_chunks(self,all_chunks )->None:
        with open(self.chunks_path+self.pdf_name+".json", 'w') as file:
            json.dump(all_chunks, file)

    def run(self ):
        all_pages = self.extract_pages()
        all_chunks = self.chunk_pages(all_pages)
        self.save_chunks(all_chunks=all_chunks)

    def load_chunks(self)->list:
        with open(self.chunks_path+self.pdf_name+".json", 'r') as file:
            data = json.load(file)
        return data



if __name__ == "__main__":
    pdf_hanlder = PdfHandler("players_handbook_5e.pdf")
    

    # pdf_hanlder.run()
    chunks = pdf_hanlder.load_chunks()
    print(chunks[45])

    
    