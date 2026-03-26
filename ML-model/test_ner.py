"""
MediScript — NER Smoke Tests
Verifies the trained model handles:
  1. English prescription input
  2. Hindi (Hinglish) prescription input
  3. Multi-medicine prescription input (English & Hindi)

Run: python test_ner.py
"""

import os
import sys
import torch

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from ner.model.NER_2 import load_model, predict_from_text

MODEL_PATH = os.path.join(BASE_DIR, "ner", "model", "mediscript_ner.pt")

# ── Test cases ────────────────────────────────────────────────────────────────
# Each entry: (category, description, input_text)

TEST_CASES = [
    # ── English ──────────────────────────────────────────────────────────────
    ("English",  "Single drug",
     "Paracetamol 650 mg twice daily for 5 days after food"),

    ("English",  "Dose in grams, abbreviated frequency",
     "Azithromycin 250 mg OD for 3 days on empty stomach"),

    ("English",  "Long duration + route",
     "Pantoprazole 40 mg once daily before breakfast for 2 weeks"),

    # ── Hindi (Hinglish – Roman script) ──────────────────────────────────────
    ("Hindi",    "subah / mahine / paani ke saath",
     "Ramipril 5 mg subah ko 1 mahine paani ke saath"),

    ("Hindi",    "raat ko / din / khali pet",
     "Ibuprofen 200 mg raat ko 7 din khali pet pe"),

    ("Hindi",    "din mein teen baar / khane ke baad",
     "Amoxycillin 250 mg din mein teen baar 10 din khane ke baad"),

    # ── Multi-medicine ────────────────────────────────────────────────────────
    ("Multi",    "Two English drugs",
     "Rosuvastatin 40 mg SOS and Loratadine 200 mg twice a day"),

    ("Multi",    "Two English drugs with full context",
     "Paracetamol 650 mg twice daily for 5 days after food "
     "and Azithromycin 500 mg OD for 3 days"),

    ("Multi",    "Mixed English + Hindi",
     "Ramipril 5 mg subah ko 1 mahine and Atenolol 1 tab OD"),

    ("Multi",    "Three drugs",
     "Metformin 500 mg twice daily and Pantoprazole 40 mg OD "
     "before breakfast and Vitamin B12 once daily"),
]


def fmt_result(r: dict) -> str:
    lines = [
        f"  Drugs      : {r.get('drugs', [])}",
        f"  Doses      : {r.get('doses', [])}",
        f"  Frequencies: {r.get('frequencies', [])}",
        f"  Durations  : {r.get('durations', [])}",
        f"  Routes     : {r.get('routes', [])}",
    ]
    return "\n".join(lines)


def main():
    if not os.path.exists(MODEL_PATH):
        print(f"ERROR: Model not found at {MODEL_PATH}")
        print("Train the model first via ner/model/NER_2.py")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading NER model on {device} …\n")
    model, vocab, id_to_label = load_model(MODEL_PATH, device)

    results_by_cat: dict[str, list] = {"English": [], "Hindi": [], "Multi": []}

    for cat, desc, text in TEST_CASES:
        print(f"{'─' * 65}")
        print(f"[{cat}]  {desc}")
        print(f"Input : {text}")
        result = predict_from_text(text, model, vocab, id_to_label, device)
        print(fmt_result(result))

        # A test passes if at least one drug was extracted
        passed = bool(result.get("drugs"))
        status = "✅ PASS" if passed else "❌ FAIL — no drug detected"
        print(f"Status: {status}\n")
        results_by_cat[cat].append(passed)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=" * 65)
    print("SUMMARY")
    print("=" * 65)
    total_pass = total_total = 0
    for cat, outcomes in results_by_cat.items():
        p, t = sum(outcomes), len(outcomes)
        total_pass  += p
        total_total += t
        bar = "█" * p + "░" * (t - p)
        print(f"  {cat:<10} [{bar}]  {p}/{t}")
    print(f"  {'TOTAL':<10}               {total_pass}/{total_total}")
    print("=" * 65)

    if total_pass < total_total:
        print("\n⚠  Some tests failed — the model may need retraining on "
              "those patterns or the vocabulary may not cover those tokens.")
    else:
        print("\n🎉 All tests passed!")


if __name__ == "__main__":
    main()
