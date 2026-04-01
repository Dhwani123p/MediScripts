"""
MediScript — Hugging Face Space entry point  (Docker SDK)
Serves on port 7860:
  • GET  /          → Simple HTML demo UI
  • POST /api/predict       → REST: { text }  → { medicines, raw }
  • POST /api/process-audio → REST: audio file → { transcript, medicines, raw }

Models are loaded at module-import time (before uvicorn starts serving),
which is the correct pattern — uvicorn then binds the port immediately
after the import and health checks pass without timeout.
"""

import os
import sys
import tempfile

import torch
import whisper
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from ner.model.NER_2 import load_model, predict_from_text
from normalize import normalize_entity

NER_MODEL_PATH = os.path.join(BASE_DIR, "ner", "model", "mediscript_ner.pt")

# ── Load models once at startup (module-level, runs before uvicorn serves) ────
_device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[MediScript] Loading models on {_device} …", flush=True)

_whisper                    = whisper.load_model("base")
_ner, _vocab, _id2label     = load_model(NER_MODEL_PATH, _device)

print("[MediScript] Models ready.", flush=True)


# ── FastAPI app ────────────────────────────────────────────────────────────────

app = FastAPI(title="MediScript NER API", version="2.0.0")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_ner(text: str) -> dict:
    return predict_from_text(text, _ner, _vocab, _id2label, _device)


def _group_entities(raw: dict) -> list:
    """
    Walk raw_tokens (BIO labels) to group entities by drug boundary so that
    each medicine only picks up entities that appear after its own B-DRUG tag.
    Confidence scores from raw['confidence_scores'] are attached per field.
    Falls back to flat-list index alignment when raw_tokens is absent.
    """
    tokens      = raw.get("raw_tokens", [])   # [(word, label), ...]
    conf_scores = raw.get("confidence_scores", {})

    _LABEL_MAP = {
        "DRUG": "drug", "DOSE": "dose", "FREQ": "freq",
        "DUR":  "dur",  "ROUTE": "route",
    }
    _CONF_KEY = {
        "drug":  "drugs",       "dose":  "doses",
        "freq":  "frequencies", "dur":   "durations",
        "route": "routes",
    }

    def _score(field, i):
        lst = conf_scores.get(field, [])
        return lst[i] if i < len(lst) else None

    def _empty_block():
        return {
            "drug": [], "dose": [], "freq": [], "dur": [], "route": [],
            "conf": {"drug": None, "dose": None, "freq": None, "dur": None, "route": None},
        }

    def _to_medicine(m: dict) -> dict:
        return {
            "drug":      " ".join(m["drug"]),
            "dose":      " ".join(m["dose"]),
            "frequency": " ".join(m["freq"]),
            "duration":  " ".join(m["dur"]),
            "route":     " ".join(m["route"]),
            "confidence": {
                "drug":      m["conf"]["drug"],
                "dose":      m["conf"]["dose"],
                "frequency": m["conf"]["freq"],
                "duration":  m["conf"]["dur"],
                "route":     m["conf"]["route"],
            },
        }

    if not tokens:
        # Fallback: simple index alignment
        drugs  = raw.get("drugs",      [])
        doses  = raw.get("doses",       [])
        freqs  = raw.get("frequencies", [])
        durs   = raw.get("durations",   [])
        routes = raw.get("routes",      [])
        n = max(len(drugs), 1)
        return [
            {
                "drug":      drugs[i]  if i < len(drugs)  else "",
                "dose":      doses[i]  if i < len(doses)  else "",
                "frequency": freqs[i]  if i < len(freqs)  else "",
                "duration":  durs[i]   if i < len(durs)   else "",
                "route":     routes[i] if i < len(routes) else "",
                "confidence": {
                    "drug":      _score("drugs",       i),
                    "dose":      _score("doses",       i),
                    "frequency": _score("frequencies", i),
                    "duration":  _score("durations",   i),
                    "route":     _score("routes",      i),
                },
            }
            for i in range(n)
        ]

    # BIO walk — track entity counts per type to index into confidence_scores
    medicines  = []
    current    = _empty_block()
    entity_idx = {"drug": 0, "dose": 0, "freq": 0, "dur": 0, "route": 0}
    active_key = None

    for word, label in tokens:
        if label == "O":
            active_key = None
            continue
        bio, etype = label.split("-", 1)
        key = _LABEL_MAP.get(etype)
        if key is None:
            continue

        if bio == "B":
            ck    = _CONF_KEY[key]
            idx   = entity_idx[key]
            score = conf_scores.get(ck, [])[idx] if idx < len(conf_scores.get(ck, [])) else None
            entity_idx[key] += 1
            if key == "drug":
                if current["drug"]:
                    medicines.append(current)
                current = _empty_block()
            current[key]         = [word]
            current["conf"][key] = score
            active_key           = key

        elif bio == "I" and active_key == key:
            current[key].append(word)

    if current["drug"]:
        medicines.append(current)

    if not medicines:
        return [{"drug": "", "dose": "", "frequency": "", "duration": "", "route": "",
                 "confidence": {"drug": None, "dose": None, "frequency": None,
                                "duration": None, "route": None}}]

    return [_to_medicine(m) for m in medicines]


# ── REST Endpoints ────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    text: str


@app.post("/api/predict")
async def predict(req: PredictRequest):
    """
    Extract prescription entities from text.
    Request : { "text": "Paracetamol 650 mg twice daily for 5 days after food" }
    Response: { "medicines": [{drug,dose,frequency,duration,route,confidence}],
                "raw": {drugs,doses,...,confidence_scores} }
    """
    text = req.text.strip()
    if not text:
        return JSONResponse({"error": "text is required"}, status_code=400)
    raw = _run_ner(text)
    grouped = _group_entities(raw)
    medicines = [{**normalize_entity(m), "confidence": m["confidence"]} for m in grouped]
    return {
        "medicines": medicines,
        "raw": {k: v for k, v in raw.items() if k != "raw_tokens"},
    }


@app.post("/api/process-audio")
async def process_audio(file: UploadFile = File(...)):
    """
    Transcribe audio (webm/wav/mp3/m4a) with Whisper then run NER.
    Returns: { transcript, medicines, raw }
    """
    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = _whisper.transcribe(
            tmp_path, language=None, fp16=False, temperature=0
        )
        transcript = result["text"].strip()
    finally:
        os.unlink(tmp_path)

    if not transcript:
        return JSONResponse({"error": "No speech detected in audio"}, status_code=422)

    raw = _run_ner(transcript)
    grouped = _group_entities(raw)
    medicines = [{**normalize_entity(m), "confidence": m["confidence"]} for m in grouped]
    return {
        "transcript": transcript,
        "medicines":  medicines,
        "raw":        {k: v for k, v in raw.items() if k != "raw_tokens"},
    }


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Simple HTML Demo UI ───────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index():
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MediScript NER</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:20px;color:#1a1a2e}
  h1{color:#008080}
  textarea{width:100%;height:90px;border:1px solid #ccc;border-radius:8px;padding:10px;font-size:14px;resize:vertical;box-sizing:border-box}
  button{background:#008080;color:#fff;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:14px;margin-top:8px}
  button:hover{background:#006666}
  pre{background:#f4f4f4;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:13px;min-height:60px}
  .examples{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
  .ex{background:#e0f2f1;border:1px solid #008080;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;color:#008080}
  .ex:hover{background:#b2dfdb}
</style>
</head>
<body>
<h1>MediScript NER API</h1>
<p>AI prescription entity extractor — BiLSTM-CRF NER · OpenAI Whisper ASR</p>
<p>Extracts <strong>drug · dose · frequency · duration · route</strong> from English or Hindi (Hinglish) text.
Confidence scores (HIGH / MED / LOW) shown for each field.</p>

<h3>Try it</h3>
<div class="examples">
  <span class="ex" onclick="fill(this)">Paracetamol 650 mg twice daily for 5 days after food</span>
  <span class="ex" onclick="fill(this)">Azithromycin 250 mg OD for 3 days on empty stomach</span>
  <span class="ex" onclick="fill(this)">Ramipril 5 mg subah ko 1 mahine paani ke saath</span>
  <span class="ex" onclick="fill(this)">Paracetamol 650 mg twice daily for 5 days and Azithromycin 500 mg OD for 3 days</span>
</div>
<textarea id="inp" placeholder="Type a prescription sentence…"></textarea>
<button onclick="extract()">Extract entities</button>

<h3>Result</h3>
<pre id="out">—</pre>

<script>
function fill(el){document.getElementById('inp').value=el.textContent}
async function extract(){
  const text=document.getElementById('inp').value.trim();
  if(!text)return;
  document.getElementById('out').textContent='Extracting…';
  try{
    const r=await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    const d=await r.json();
    if(d.error){document.getElementById('out').textContent='Error: '+d.error;return}
    let out='';
    d.medicines.forEach((m,i)=>{
      if(d.medicines.length>1)out+='[Medicine '+(i+1)+']\n';
      const c=m.confidence||{};
      const tag=s=>s==null?'':s>=0.85?' [HIGH '+Math.round(s*100)+'%]':s>=0.65?' [MED '+Math.round(s*100)+'%]':'  [LOW '+Math.round(s*100)+'%] ⚠';
      out+='Drug      : '+m.drug+tag(c.drug)+'\n';
      out+='Dose      : '+m.dose+tag(c.dose)+'\n';
      out+='Frequency : '+m.frequency+tag(c.frequency)+'\n';
      out+='Duration  : '+m.duration+tag(c.duration)+'\n';
      out+='Route     : '+m.route+tag(c.route)+'\n';
      if(i<d.medicines.length-1)out+='\n';
    });
    document.getElementById('out').textContent=out;
  }catch(e){document.getElementById('out').textContent='Error: '+e.message}
}
</script>
</body>
</html>"""
