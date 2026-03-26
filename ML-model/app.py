"""
MediScript — Hugging Face Space entry point  (Docker SDK)
Serves two things on port 7860:
  • GET  /          → Gradio UI  (audio + text tabs, English & Hinglish)
  • POST /api/predict → REST JSON API  { text } → { medicines, raw }

The /api/predict endpoint is consumed by the telemedicine backend
to auto-fill editable prescription forms.
"""

import os
import sys
import tempfile

import gradio as gr
import torch
import whisper
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from ner.model.NER_2 import load_model, predict_from_text

NER_MODEL_PATH = os.path.join(BASE_DIR, "ner", "model", "mediscript_ner.pt")

# ── Load models once at startup ───────────────────────────────────────────────
_device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[MediScript] Loading models on {_device} …")

_whisper    = whisper.load_model("base")
_ner, _vocab, _id2label = load_model(NER_MODEL_PATH, _device)

print("[MediScript] Models ready.")


# ── Shared helpers ────────────────────────────────────────────────────────────

def _run_ner(text: str) -> dict:
    return predict_from_text(text, _ner, _vocab, _id2label, _device)


def _group_entities(raw: dict) -> list[dict]:
    """
    Zip flat entity lists into per-medicine dicts using index alignment.
    drugs[i] is paired with doses[i], frequencies[i], durations[i], routes[i].
    This works because the BIO tagger emits entities in the order they appear
    in the sentence, so drug 0 always precedes dose 0, etc.
    """
    drugs  = raw.get("drugs",       [])
    doses  = raw.get("doses",        [])
    freqs  = raw.get("frequencies",  [])
    durs   = raw.get("durations",    [])
    routes = raw.get("routes",       [])

    n = max(len(drugs), 1)
    return [
        {
            "drug":      drugs[i]  if i < len(drugs)  else "",
            "dose":      doses[i]  if i < len(doses)  else "",
            "frequency": freqs[i]  if i < len(freqs)  else "",
            "duration":  durs[i]   if i < len(durs)   else "",
            "route":     routes[i] if i < len(routes) else "",
        }
        for i in range(n)
    ]


def _format_md(raw: dict) -> str:
    rows = [
        ("Drug(s)",   raw.get("drugs",       [])),
        ("Dose(s)",   raw.get("doses",        [])),
        ("Frequency", raw.get("frequencies",  [])),
        ("Duration",  raw.get("durations",    [])),
        ("Route",     raw.get("routes",       [])),
    ]
    return "\n\n".join(
        f"**{lbl}:** {', '.join(vals) if vals else '—'}"
        for lbl, vals in rows
    )


# ── Gradio handlers ───────────────────────────────────────────────────────────

def run_audio(audio_path):
    if audio_path is None:
        return "", "No audio provided."
    asr_result = _whisper.transcribe(
        audio_path, language=None, fp16=False, temperature=0
    )
    transcript = asr_result["text"].strip()
    if not transcript:
        return "", "No speech detected — please try again."
    raw = _run_ner(transcript)
    return transcript, _format_md(raw)


def run_text(text: str):
    text = text.strip()
    if not text:
        return "Please enter a prescription."
    raw = _run_ner(text)
    return _format_md(raw)


# ── FastAPI (REST) ────────────────────────────────────────────────────────────

fapi = FastAPI(title="MediScript NER API", version="1.0.0")


class PredictRequest(BaseModel):
    text: str


@fapi.post("/api/predict")
async def predict(req: PredictRequest):
    """
    Extract prescription entities from a text string.

    Request body : { "text": "Paracetamol 650 mg twice daily for 5 days" }
    Response     : {
        "medicines": [{ "drug", "dose", "frequency", "duration", "route" }, …],
        "raw": { "drugs": […], "doses": […], … }
    }
    Supports English and Hindi (Hinglish) input.
    Multiple medicines in one sentence are split into separate objects.
    """
    text = req.text.strip()
    if not text:
        return JSONResponse({"error": "text is required"}, status_code=400)

    raw = _run_ner(text)
    return {
        "medicines": _group_entities(raw),
        "raw": {k: v for k, v in raw.items() if k != "raw_tokens"},
    }


@fapi.post("/api/process-audio")
async def process_audio(file: UploadFile = File(...)):
    """
    Transcribe an audio recording with Whisper, then extract prescription
    entities with the BiLSTM-CRF NER model.

    Accepts any format ffmpeg can decode: webm, wav, mp3, m4a, ogg …
    Returns:
      {
        "transcript": "…",
        "medicines":  [{ "drug", "dose", "frequency", "duration", "route" }, …],
        "raw":        { "drugs": […], … }
      }
    """
    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result_asr = _whisper.transcribe(
            tmp_path, language=None, fp16=False, temperature=0
        )
        transcript = result_asr["text"].strip()
    finally:
        os.unlink(tmp_path)

    if not transcript:
        return JSONResponse({"error": "No speech detected in audio"}, status_code=422)

    raw = _run_ner(transcript)
    return {
        "transcript": transcript,
        "medicines":  _group_entities(raw),
        "raw":        {k: v for k, v in raw.items() if k != "raw_tokens"},
    }


# ── Gradio UI ─────────────────────────────────────────────────────────────────

EXAMPLES = [
    # English
    "Paracetamol 650 mg twice daily for 5 days after food",
    "Azithromycin 250 mg OD for 3 days on empty stomach",
    "Pantoprazole 40 mg once daily before breakfast for 2 weeks",
    # Hindi (Hinglish)
    "Ramipril 5 mg subah ko 1 mahine paani ke saath",
    "Ibuprofen 200 mg raat ko 7 din khali pet pe",
    # Multi-medicine
    "Rosuvastatin 40 mg SOS and Loratadine 200 mg twice a day",
    "Paracetamol 650 mg twice daily for 5 days and Azithromycin 500 mg OD for 3 days",
]

with gr.Blocks(title="MediScript") as demo:

    gr.Markdown(
        """
# 💊 MediScript
### AI-powered prescription entity extractor
Extracts **drug names · doses · frequencies · durations · routes** from spoken or typed prescriptions.
Supports **English** and **Hindi (Hinglish)** — detects **multiple medicines** in one sentence.
        """
    )

    with gr.Tab("🎙️ Audio"):
        gr.Markdown("Upload a WAV / MP3 / M4A recording of a spoken prescription.")
        audio_in  = gr.Audio(type="filepath", label="Prescription audio")
        audio_btn = gr.Button("Extract", variant="primary")
        audio_transcript = gr.Textbox(label="Transcript", interactive=False)
        audio_out = gr.Markdown(label="Extracted entities")
        audio_btn.click(
            run_audio,
            inputs=audio_in,
            outputs=[audio_transcript, audio_out],
        )

    with gr.Tab("⌨️  Text"):
        gr.Markdown(
            "Type or paste a prescription (English or Hinglish). "
            "Multiple medicines separated by **and** are all extracted."
        )
        text_in  = gr.Textbox(
            label="Prescription text",
            placeholder="e.g. Ibuprofen 400 mg raat ko 5 din khane ke baad "
                        "and Pantoprazole 40 mg subah OD",
            lines=3,
        )
        text_btn = gr.Button("Extract", variant="primary")
        text_out = gr.Markdown(label="Extracted entities")
        text_btn.click(run_text, inputs=text_in, outputs=text_out)

        gr.Examples(examples=EXAMPLES, inputs=text_in, label="Examples")


# Mount Gradio onto FastAPI — the combined ASGI app is what uvicorn serves
app = gr.mount_gradio_app(fapi, demo, path="/")
