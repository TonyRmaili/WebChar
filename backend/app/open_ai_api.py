from openai import OpenAI
from dotenv import load_dotenv
import os
import base64
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
        self.model = "gpt-6-luna"
        self.image_model = "gpt-image-2.5-sunburst"
        # The notes search (app/rag): 1536 numbers per text, cheap.
        self.embed_model = "text-embedding-3-small"
        # What the last call spent (OpenAI's own count). The campaign
        # routes add it to the user's day (app/ai_usage.py).
        self.last_tokens = 0

    def file_divider(self,file_name):
        return f"\n## File: {file_name}\n"

    def extend_instructions(self, instructions, files) -> str:
        """files: (name, text) pairs. Campaign notes come as their plain
        text (routers/campaigns.py reads them), never as the editor's JSON."""
        extended_inst = instructions

        for file_name, data in files:
            extended_inst += self.file_divider(file_name) + data

        return extended_inst

    def chat(self, messages, instructions, reasoning="low"):
        response = self.client.responses.create(
            model=self.model,
            input=messages,
            reasoning={"effort": reasoning},
            instructions = instructions
        )

        self.last_tokens = self._tokens(response)
        return response.output_text


    def chat_stream(self, messages, instructions, reasoning="low"):
        """Like chat(), but hands out the answer's text piece by piece while
        the model writes it (a generator: use it in a for loop). When it has
        run to the end, last_tokens holds what the answer spent."""
        self.last_tokens = 0
        stream = self.client.responses.create(
            model=self.model,
            input=messages,
            reasoning={"effort": reasoning},
            instructions=instructions,
            stream=True,
        )
        for event in stream:
            kind = getattr(event, "type", "")
            if kind == "response.output_text.delta":
                yield event.delta
            elif kind == "response.completed":
                self.last_tokens = self._tokens(event.response)
            elif kind in ("response.failed", "error"):
                error = getattr(event, "error", None) or getattr(getattr(event, "response", None), "error", None)
                raise RuntimeError(getattr(error, "message", None) or "the model stopped with an error")

    def chat_log_stream(self, instructions, files, messages):
        """The DM Assistant: the prompts and the found notes as instructions,
        the answer streamed (chat_stream)."""
        return self.chat_stream(
            messages=messages,
            instructions=self.extend_instructions(instructions, files),
            reasoning="low",
        )

    def image_gen(self, prompt, savepath):
        """Paint `prompt` with the image model and save it at `savepath` (.png).
        The model sends the picture as base64 text; it is turned back into
        bytes and written by FileHandler."""
        result = self.client.images.generate(
            model=self.image_model,
            prompt=prompt,
        )

        self.last_tokens = self._tokens(result)
        image_bytes = base64.b64decode(result.data[0].b64_json)
        FileHandler().save_bytes(savepath, image_bytes)
        return savepath

    def embed(self, texts):
        """Embeddings for `texts` (each a list of 1536 numbers, in the same
        order), and the tokens spent. Used by the notes search (app/rag)."""
        response = self.client.embeddings.create(model=self.embed_model, input=texts)
        vectors = [d.embedding for d in sorted(response.data, key=lambda d: d.index)]
        self.last_tokens = self._tokens(response)
        return vectors, self.last_tokens

    @staticmethod
    def _tokens(response) -> int:
        """The tokens a reply says it used: words in and out for the
        assistant, the picture's tokens for the image model. 0 if it doesn't say."""
        usage = getattr(response, "usage", None)
        return int(getattr(usage, "total_tokens", 0) or 0)



    # ─────────────────────────────────────────────
    # Data pipeline
    #
    # Used by app/data_cleaning (llm_cleaner.py).
    # ─────────────────────────────────────────────

    def parse_model(self, instructions, input, text_format, reasoning="medium", timeout=None):
        """Ask for an answer shaped like `text_format` (a Pydantic model).

        Returns (model instance, tokens used). Unlike parse(), it always
        returns the same shape and never returns an error dict: anything
        that goes wrong raises LLMError with a readable message, so the
        caller can't mistake a failure for an answer.
        """
        try:
            response = self.client.responses.parse(
                model=self.model,
                input=input,
                instructions=instructions,
                reasoning={"effort": reasoning},  # a fresh dict per call, nothing shared
                text_format=text_format,
                timeout=timeout,
            )
        except ValidationError as e:
            raise LLMError(f"the answer didn't match {text_format.__name__}: {e}")
        except Exception as e:  # network, key, rate limit, schema refused by the API…
            raise LLMError(f"{type(e).__name__}: {e}")

        parsed = response.output_parsed
        if parsed is None:
            raise LLMError("the model returned no answer (refusal or empty output)")
        tokens = response.usage.total_tokens if response.usage else 0
        return parsed, tokens


class LLMError(Exception):
    """An LLM call that didn't give a usable answer."""


if __name__== "__main__":
    openAI = OpenAIApi()
    prompt = "A portrait of my dnd character Myslov the barbarian. A goliath with red beard, dark eyes and wielding a greatsword"
    openAI.image_gen(
        prompt=prompt,
        savepath="test_image.png"
    )
