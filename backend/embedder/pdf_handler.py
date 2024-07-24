import fitz 


def extract_pages(pdf_path):
    document = fitz.open(pdf_path)
    all_pages = []
    for page_num in range(document.page_count):
        page = document.load_page(page_num)
        text = page.get_text("text")
        all_pages.append({"text":text, "page_num":(page_num+1)})
    return all_pages


def chunk_pages(all_pages, chunk_size=600, over_lap=100):
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
            end = min(start + chunk_size, len(words))

            chunk = ' '.join(words[start:end])
            end_page = current_page_num  # Update end_page to the current page number
            page_nums = (start_page, end_page) if start_page != end_page else (start_page,)
            chunked_pages.append({"chunk": chunk, "page_nums": page_nums})

            start += (chunk_size - over_lap)

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


if __name__ == "__main__":

    pdf_path = "./game_rules/players_handbook_5e.pdf"

    all_pages=extract_pages(pdf_path)
    print(all_pages[1])