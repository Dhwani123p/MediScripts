import whisper
import numpy as np
import sounddevice as sd


# Whisper always expects 16kHz mono audio
SAMPLE_RATE = 16000


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
        Transcribes an audio FILE to text.
        Kept exactly as before — used by run_pipeline.py for file input.
        """
        result = self.model.transcribe(
            audio_path,
            language=self.language,
            fp16=False,
        )
        return result["text"].strip()

    def transcribe_from_mic(self, duration=10):
        """
        Records audio directly from microphone and transcribes it.
        NO audio file is written to disk — audio lives only in memory (numpy array).

        duration: max recording seconds (default 10).
                  Recording stops early if user presses Enter before time is up.

        Returns: transcript string
        """
        print(f"Recording for up to {duration} seconds... Press Enter to stop early.")

        # sounddevice records into a numpy array — nothing touches the filesystem
        audio_data = sd.rec(
            frames=int(duration * SAMPLE_RATE),
            samplerate=SAMPLE_RATE,
            channels=1,          # mono — Whisper requirement
            dtype="float32",     # Whisper requirement
        )

        # Wait for Enter key or until duration completes
        input()                  # blocks until Enter is pressed
        sd.stop()                # stops recording immediately

        # audio_data shape is (frames, 1) — Whisper needs (frames,)
        audio_flat = audio_data.flatten()

        print("Transcribing...")
        result = self.model.transcribe(
            audio_flat,          # pass numpy array directly, no file needed
            language=self.language,
            fp16=False,
        )
        return result["text"].strip()