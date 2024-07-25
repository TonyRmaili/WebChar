import fitz 
import json


class PdfHandler:
    def __init__(self,pdf_name):
        self.game_rules_path = "./game_rules/"
        self.chunks_path = "./pdf_chunks/"
        self.pdf_name = pdf_name
        self.full_path = self.game_rules_path+self.pdf_name

        self.chunk_size = 600
        self.overlap = 100


    def extract_pages(self):
        document = fitz.open(self.full_path)
        all_pages = []
        for page_num in range(document.page_count):
            page = document.load_page(page_num)
            text = page.get_text("text")
            all_pages.append({"text":text, "page_num":(page_num+1)})
        return all_pages
    
    def chunk_pages(self,all_pages):
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
    

    def save_chunks(self,all_chunks):
        with open(self.chunks_path+"players_handbook_5e.json", 'w') as file:
            json.dump(all_chunks, file)


    def run(self):
        all_pages = self.extract_pages()
        all_chunks = self.chunk_pages(all_pages)
        self.save_chunks(all_chunks=all_chunks)


if __name__ == "__main__":
    pdf_hanlder = PdfHandler("players_handbook_5e.pdf")
    pdf_hanlder.run()