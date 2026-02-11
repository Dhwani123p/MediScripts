from asr.whisper_transcribe import WhisperASR
from ner.predict import load_model, predict_from_text
import json
import torch

def main():
    # -------- Load Whisper --------
    asr = WhisperASR(
        model_size="base",
        language=None   # auto-detect
    )

    # -------- Load NER --------
    device = "cuda" if torch.cuda.is_available() else "cpu"

    model, vocab, id_to_label = load_model(
        "ner/mediscript_ner.pt",
        device=device
    )

    # -------- Input audio --------
    audio_path = r"D:\MediScript\python_service\asr\audio 1.aac"   # put a test audio here

    # Note: avoid emojis in console output to prevent UnicodeEncodeError on Windows.
    print("Transcribing audio...")
    text = asr.transcribe(audio_path)
    print("Transcript:", text)

    # -------- NER extraction --------
    print("Extracting prescription...")
    result = predict_from_text(text, model, vocab, id_to_label)

    print("\nFinal structured output:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
