import whisper
from flask import Flask, request, jsonify
import os

app = Flask(__name__)

# Load the multilingual Whisper model
model = whisper.load_model("small")  # or "medium" or "large" for better results

@app.route("/transcribe", methods=["POST"])
def transcribe():
    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"error": "No audio file uploaded"}), 400

    # Save uploaded file temporarily
    temp_path = "temp_audio.wav"
    audio_file.save(temp_path)

    # Step 1: Auto-detect language and transcribe
    result = model.transcribe(temp_path)

    detected_language = result.get("language", "unknown")
    original_transcript = result["text"]

    # Step 2: Translate to English (if not already English)
    # Whisper can translate any supported language to English
    translation_result = model.transcribe(temp_path, task="translate")
    english_transcript = translation_result["text"]

    # Clean up temp file
    os.remove(temp_path)

    return jsonify({
        "original_transcript": original_transcript,
        "detected_language": detected_language,
        "english_transcript": english_transcript,
        "segments": result.get("segments", [])
    })

if __name__ == "__main__":
    app.run(debug=True)
