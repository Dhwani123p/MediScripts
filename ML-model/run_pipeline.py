f"""
MediScript - Full Pipeline with Real-Time Mic Input
Usage:
    python run_pipeline.py
"""

import os
import sys
import json
import torch
import numpy as np
import sounddevice as sd

# ── Make sure sibling packages are importable ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from asr.whisper_transcribe import WhisperASR
from ner.model.NER_2 import load_model, predict_from_text

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
SAMPLE_RATE    = 16000   # Whisper requires 16kHz
MAX_DURATION   = 30      # max seconds to record
NER_MODEL_PATH = os.path.join(BASE_DIR, "ner", "model", "mediscript_ner.pt")

# ─────────────────────────────────────────────
# Mic recording — no file saved to disk
# ─────────────────────────────────────────────

def record_from_mic(max_duration=MAX_DURATION):
    """
    Records audio from microphone into a numpy array.
    Press Enter to stop early.
    Returns: float32 numpy array at 16kHz (what Whisper expects)
    """
    print(f"\nRecording... (max {max_duration}s)")
    print("Speak your prescription now.")
    print("Press Enter to stop recording.\n")

    audio_data = sd.rec(
        frames=int(max_duration * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        device=9,
    )

    input()          # blocks until Enter is pressed
    sd.stop()        # stop recording immediately

    # Flatten from (frames, 1) → (frames,) — Whisper requirement
    return audio_data.flatten()

# ─────────────────────────────────────────────
# Pretty printer
# ─────────────────────────────────────────────

def print_prescription(result):
    print("\n" + "=" * 50)
    print("       EXTRACTED PRESCRIPTION")
    print("=" * 50)
    print(f"  Drug(s)      : {', '.join(result.get('drugs',       [])) or '-'}")
    print(f"  Dose(s)      : {', '.join(result.get('doses',       [])) or '-'}")
    print(f"  Frequency    : {', '.join(result.get('frequencies', [])) or '-'}")
    print(f"  Duration     : {', '.join(result.get('durations',   [])) or '-'}")
    print(f"  Route        : {', '.join(result.get('routes',      [])) or '-'}")
    print("=" * 50)

    print("\nToken-level labels:")
    for tok, lbl in result.get("raw_tokens", []):
        print(f"  {tok:<20} {lbl}")

# ─────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────

def main():
    # ── Check model exists ──
    if not os.path.exists(NER_MODEL_PATH):
        print(f"ERROR: NER model not found at {NER_MODEL_PATH}")
        print("Run train.py first.")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    # ── Load Whisper ──
    print("Loading Whisper...")
    asr = WhisperASR(model_size="base", language=None)

    # ── Load NER ──
    print("Loading NER model...")
    model, vocab, id_to_label = load_model(NER_MODEL_PATH, device)
    print("Models ready.\n")

    # ── Main loop — keep running until user quits ──
    while True:
        print("\n" + "-" * 50)
        print("Options:")
        print("  1 - Record from microphone")
        print("  2 - Type prescription manually (for testing)")
        print("  q - Quit")
        choice = input("\nChoice: ").strip().lower()

        if choice == "q":
            print("Exiting.")
            break

        # ── Option 1: Mic input ──
        elif choice == "1":
            try:
                audio_array = record_from_mic()
            except Exception as e:
                print(f"Mic error: {e}")
                print("Make sure a microphone is connected.")
                continue
            print("Transcribing...")
            try:
                # Check if audio has actual speech (not just silence)
                if np.max(np.abs(audio_array)) < 0.01:
                    print("No speech detected - audio too quiet. Please try again.")
                    continue

                result_asr = asr.model.transcribe(
                    audio_array,
                    language="en",   # force English to reduce hallucination
                    fp16=False,
                    temperature=0,   # makes Whisper more conservative, less hallucination
                )


                text = result_asr["text"].strip()
                lang = result_asr.get("language", "unknown")
            except Exception as e:
                print(f"Transcription error: {e}")
                continue

            if not text:
                print("No speech detected. Please try again.")
                continue

            print(f"\nDetected language : {lang}")
            print(f"Transcript        : {text}")

        # ── Option 2: Manual text input ──
        elif choice == "2":
            text = input("\nType prescription text: ").strip()
            if not text:
                print("Empty input. Try again.")
                continue
            lang = "manual"
            print(f"Input: {text}")

        else:
            print("Invalid choice. Enter 1, 2, or q.")
            continue

        # ── NER extraction ──
        print("\nExtracting entities...")
        try:
            result = predict_from_text(text, model, vocab, id_to_label, device)
        except Exception as e:
            print(f"NER error: {e}")
            continue

        # ── Output ──
        print_prescription(result)

        # ── Save to JSON (optional) ──
        save = input("\nSave output to JSON? (y/n): ").strip().lower()
        if save == "y":
            out = {
                "transcript":   text,
                "language":     lang,
                "prescription": {k: v for k, v in result.items() if k != "raw_tokens"}
            }
            out_path = os.path.join(BASE_DIR, "last_prescription.json")
            with open(out_path, "w") as f:
                json.dump(out, f, indent=2)
            print(f"Saved to {out_path}")


if __name__ == "__main__":
    main()