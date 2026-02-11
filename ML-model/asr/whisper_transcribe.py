import whisper


class WhisperASR:
    def __init__(self, model_size="base", language=None):
        """
        model_size: tiny | base | small | medium
        language: 'en', 'hi', or None (auto-detect)
        """
        self.model = whisper.load_model(model_size)
        self.language = language

    def transcribe(self, audio_path):
        """
        Transcribes audio file to text
        """
        result = self.model.transcribe(
            audio_path,
            language=self.language,
            fp16=False,  # safer for CPU
        )
        return result["text"].strip()

