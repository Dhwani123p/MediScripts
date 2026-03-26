"""
MediScript - Synthetic CoNLL Data Generator
Improvements over original:
  - 10x more templates (English + Hindi)
  - Multi-drug sentences
  - ASR noise injection
  - Abbreviation variants (BD, TDS, OD, etc.)
  - Proper ROUTE multi-token handling for all route phrases
  - Windows \r\n line-ending fix (writes clean \n always)
  - Dataset size raised to 5000 sentences
  - Shuffle before writing so train set is not all-English first
"""

import random
import os

# ───────────────────────────────────────────
# 1. Load drug list
# ───────────────────────────────────────────

def load_drug_list(path):
    with open(path, encoding="utf-8") as f:
        # strip() handles both \r\n (Windows) and \n (Unix)
        return [line.strip() for line in f if line.strip()]

DRUG_LIST_PATH = os.path.join(os.path.dirname(__file__), "drug_list.txt")
DRUGS = load_drug_list(DRUG_LIST_PATH)

# ───────────────────────────────────────────
# 2. Controlled vocabularies
# ───────────────────────────────────────────

DOSES = [
    ("250", "mg"), ("500", "mg"), ("650", "mg"),
    ("10",  "mg"), ("20",  "mg"), ("40",  "mg"),
    ("5",   "mg"), ("100", "mg"), ("200", "mg"),
    ("1",   "g"),  ("0.5", "g"),
    ("5",   "ml"), ("10",  "ml"),
    ("1",   "tab"),("2",   "tabs"),
]

# English frequencies - each is a list of tokens
FREQS_EN = [
    ["once", "daily"],
    ["twice", "a", "day"],
    ["twice", "daily"],
    ["thrice", "daily"],
    ["three", "times", "a", "day"],
    ["every", "six", "hours"],
    ["every", "eight", "hours"],
    ["every", "twelve", "hours"],
    ["at", "night"],
    ["at", "bedtime"],
    ["in", "the", "morning"],
    ["BD"],           # abbreviation - single token
    ["TDS"],
    ["OD"],
    ["QID"],
    ["SOS"],          # as needed
    ["once", "a", "week"],
    ["twice", "a", "week"],
]

DURS_EN = [
    ["3",  "days"],
    ["5",  "days"],
    ["7",  "days"],
    ["10", "days"],
    ["14", "days"],
    ["1",  "week"],
    ["2",  "weeks"],
    ["1",  "month"],
    ["3",  "months"],
    ["as", "directed"],   # open-ended
]

ROUTES_EN = [
    ["after",  "food"],
    ["before", "food"],
    ["after",  "meals"],
    ["before", "meals"],
    ["before", "breakfast"],
    ["after",  "breakfast"],
    ["with",   "water"],
    ["with",   "milk"],
    ["on",     "empty", "stomach"],
    ["orally"],
    ["sublingually"],
]

# Hindi (Roman script) frequencies
FREQS_HI = [
    ["din",  "mein", "ek",  "baar"],
    ["din",  "mein", "do",  "baar"],
    ["din",  "mein", "teen","baar"],
    ["roz",  "ek",   "baar"],
    ["raat", "ko"],
    ["subah","ko"],
    ["subah","aur",  "raat","ko"],
    ["har",  "chhe", "ghante","mein"],
]

DURS_HI = [
    ["3",  "din"],
    ["5",  "din"],
    ["7",  "din"],
    ["10", "din"],
    ["1",  "hafte"],
    ["2",  "hafte"],
    ["1",  "mahine"],
]

ROUTES_HI = [
    ["khane", "ke",  "baad"],
    ["khane", "se",  "pehle"],
    ["khali", "pet", "pe"],
    ["paani", "ke",  "saath"],
    ["dudh",  "ke",  "saath"],
]

# ───────────────────────────────────────────
# 3. ASR noise variants
#    Maps canonical drug name → list of noisy forms
# ───────────────────────────────────────────

ASR_NOISE = {
    "Paracetamol":   ["Parasitamol", "Paracitamol", "Paracitomol"],
    "Amoxicillin":   ["Amoxycillin", "Amoxicilin",  "Amoxsicilin"],
    "Azithromycin":  ["Azithromicin","Azithramycin","Azithromysin"],
    "Cetirizine":    ["Setrizine",   "Cetrizine",   "Cetirizin"],
    "Ciprofloxacin": ["Ciprofloxacin","Siprofloxacin","Ciproflocassin"],
    "Metformin":     ["Metphormin",  "Metformine"],
    "Atorvastatin":  ["Atorvastatin","Atorvasatin"],
    "Pantoprazole":  ["Pantaprazole","Pentoprazole"],
    "Omeprazole":    ["Omiprazole",  "Omeperazole"],
    "Doxycycline":   ["Doxicicline", "Doxycicline"],
}

def maybe_noisify(drug_name, noise_prob=0.15):
    """With noise_prob chance, replace drug name with an ASR-like variant."""
    if drug_name in ASR_NOISE and random.random() < noise_prob:
        return random.choice(ASR_NOISE[drug_name])
    return drug_name

# ───────────────────────────────────────────
# 4. CoNLL builders - return list of (token, label)
# ───────────────────────────────────────────

def drug_tokens(name):
    """Drug name may be multi-word (e.g. 'Vitamin B12'). Label first token B-DRUG, rest I-DRUG."""
    parts = name.split()
    result = [(parts[0], "B-DRUG")]
    for p in parts[1:]:
        result.append((p, "I-DRUG"))
    return result

def dose_tokens(num, unit):
    return [(num, "B-DOSE"), (unit, "I-DOSE")]

def freq_tokens(freq_list):
    result = [(freq_list[0], "B-FREQ")]
    for w in freq_list[1:]:
        result.append((w, "I-FREQ"))
    return result

def dur_tokens(dur_list):
    result = [(dur_list[0], "B-DUR")]
    for w in dur_list[1:]:
        result.append((w, "I-DUR"))
    return result

def route_tokens(route_list):
    result = [(route_list[0], "B-ROUTE")]
    for w in route_list[1:]:
        result.append((w, "I-ROUTE"))
    return result

# ───────────────────────────────────────────
# 5. Sentence generators
# ───────────────────────────────────────────

# English templates: define which slots appear (and in what order)
TEMPLATES_EN = [
    ["DRUG", "DOSE", "FREQ", "DUR", "ROUTE"],   # full
    ["DRUG", "DOSE", "FREQ", "DUR"],             # no route
    ["DRUG", "DOSE", "FREQ"],                    # short
    ["DRUG", "DOSE", "ROUTE"],                   # no freq/dur
    ["DRUG", "FREQ", "DUR"],                     # no dose
    ["DRUG", "DOSE"],                            # minimal
]

def generate_english_sentence(noise=True):
    template = random.choice(TEMPLATES_EN)
    conll = []
    drug_name = maybe_noisify(random.choice(DRUGS)) if noise else random.choice(DRUGS)

    for slot in template:
        if slot == "DRUG":
            conll.extend(drug_tokens(drug_name))
        elif slot == "DOSE":
            num, unit = random.choice(DOSES)
            conll.extend(dose_tokens(num, unit))
        elif slot == "FREQ":
            conll.extend(freq_tokens(random.choice(FREQS_EN)))
        elif slot == "DUR":
            conll.extend(dur_tokens(random.choice(DURS_EN)))
        elif slot == "ROUTE":
            conll.extend(route_tokens(random.choice(ROUTES_EN)))

    return conll


def generate_hindi_sentence(noise=True):
    """Always full template for Hindi (DRUG DOSE FREQ DUR ROUTE)."""
    conll = []
    drug_name = maybe_noisify(random.choice(DRUGS)) if noise else random.choice(DRUGS)

    conll.extend(drug_tokens(drug_name))
    num, unit = random.choice(DOSES)
    conll.extend(dose_tokens(num, unit))
    conll.extend(freq_tokens(random.choice(FREQS_HI)))
    conll.extend(dur_tokens(random.choice(DURS_HI)))
    conll.extend(route_tokens(random.choice(ROUTES_HI)))

    return conll


def generate_multi_drug_sentence():
    """
    Two drugs in one sentence - important for real prescriptions.
    Pattern: DRUG1 DOSE FREQ then DRUG2 DOSE FREQ
    Separated by connector token labeled O.
    """
    conll = []

    for i in range(2):
        drug_name = maybe_noisify(random.choice(DRUGS))
        conll.extend(drug_tokens(drug_name))
        num, unit = random.choice(DOSES)
        conll.extend(dose_tokens(num, unit))
        conll.extend(freq_tokens(random.choice(FREQS_EN)))

        if i == 0:
            # Add connector word labeled O (outside any entity)
            connector = random.choice(["and", "with", "also"])
            conll.append((connector, "O"))

    return conll

# ───────────────────────────────────────────
# 6. Write CoNLL file
# ───────────────────────────────────────────

def write_conll_file(filename, n_en=3000, n_hi=1200, n_multi=800):
    """
    Generates and writes a shuffled CoNLL dataset.
    Total default: 5000 sentences.
    Uses newline='' + explicit \n to avoid Windows \r\n issues.
    """
    all_sentences = []

    for _ in range(n_en):
        all_sentences.append(generate_english_sentence())

    for _ in range(n_hi):
        all_sentences.append(generate_hindi_sentence())

    for _ in range(n_multi):
        all_sentences.append(generate_multi_drug_sentence())

    # Shuffle so train file isn't all-English followed by all-Hindi
    random.shuffle(all_sentences)

    # newline="" prevents Python from adding extra \r on Windows
    with open(filename, "w", encoding="utf-8", newline="") as f:
        for sent in all_sentences:
            for token, label in sent:
                f.write(f"{token} {label}\n")
            f.write("\n")   # blank line = sentence boundary

    print(f"Generated {len(all_sentences)} sentences → {filename}")
    print(f"  English: {n_en} | Hindi: {n_hi} | Multi-drug: {n_multi}")


# ───────────────────────────────────────────
# 7. Train / validation / test split writer
# ───────────────────────────────────────────

def split_and_write(total_en=3000, total_hi=1200, total_multi=800,
                    train_ratio=0.8, val_ratio=0.1):
    """
    Generates all sentences, splits into train/val/test,
    writes three separate CoNLL files.
    """
    all_sentences = []
    for _ in range(total_en):
        all_sentences.append(generate_english_sentence())
    for _ in range(total_hi):
        all_sentences.append(generate_hindi_sentence())
    for _ in range(total_multi):
        all_sentences.append(generate_multi_drug_sentence())

    random.shuffle(all_sentences)
    n = len(all_sentences)
    n_train = int(n * train_ratio)
    n_val   = int(n * val_ratio)

    splits = {
        "train.conll": all_sentences[:n_train],
        "val.conll":   all_sentences[n_train:n_train + n_val],
        "test.conll":  all_sentences[n_train + n_val:],
    }

    out_dir = os.path.dirname(os.path.abspath(__file__))
    for fname, sentences in splits.items():
        path = os.path.join(out_dir, fname)
        with open(path, "w", encoding="utf-8", newline="") as f:
            for sent in sentences:
                for token, label in sent:
                    f.write(f"{token} {label}\n")
                f.write("\n")
        print(f"  {fname}: {len(sentences)} sentences")

    print(f"\nDone. Total: {n} | Train: {n_train} | Val: {n_val} | Test: {n - n_train - n_val}")


if __name__ == "__main__":
    print("Generating train/val/test splits...")
    split_and_write()