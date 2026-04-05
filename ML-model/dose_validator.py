"""
MediScript — Dose validation against WHO reference data
Checks extracted dose against WHO Model Formulary safe limits.

Primary source: WHO Model Formulary 2008
  https://www.who.int/publications/i/item/978-92-4-154765-9
Secondary source: WHO Essential Medicines List 23rd edition (2023)
  https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02

Validation checks:
  1. Single-dose check  — dose per administration vs WHO max single dose
  2. Daily-dose check   — estimated daily dose (single × freq) vs WHO max daily dose
  3. Below-minimum check — dose suspiciously low (possible transcription error)

All doses stored in mg (or mcg where the drug is exclusively dosed in mcg).
Unit conversions applied at parse time: g→mg (×1000), mcg stays mcg.
"""

import re
import logging

log = logging.getLogger("mediscript.dose")


# ── WHO dose table ────────────────────────────────────────────────────────────
# Each entry:
#   aliases          : list[str]  — lowercase drug name variants
#   unit             : "mg" | "mcg" | "g"  — reference unit for comparisons
#   min_single       : float | None  — lowest plausible single dose (below = likely error)
#   max_single       : float | None  — WHO max per-administration dose
#   max_daily        : float | None  — WHO max total daily dose
#   typical_single   : str  — WHO typical single dose range (for display)
#   typical_daily    : str  — WHO typical daily dose range (for display)
#   source           : citation
#   notes            : str  — clinical context

_DOSE_TABLE = [

    # ── Analgesics / antipyretics ─────────────────────────────────────────────
    {
        "aliases": ["paracetamol", "acetaminophen", "crocin", "dolo", "calpol"],
        "unit": "mg",
        "min_single": 250,
        "max_single": 1000,
        "max_daily": 4000,
        "typical_single": "500–1000 mg",
        "typical_daily": "1500–4000 mg",
        "source": "WHO Model Formulary 2008, p. 26",
        "notes": "Max 4 g/day in healthy adults; 2 g/day recommended in hepatic impairment or chronic alcohol use.",
    },
    {
        "aliases": ["ibuprofen", "brufen", "combiflam", "ibugesic"],
        "unit": "mg",
        "min_single": 100,
        "max_single": 800,
        "max_daily": 2400,
        "typical_single": "200–400 mg",
        "typical_daily": "600–1200 mg",
        "source": "WHO Model Formulary 2008, p. 29",
        "notes": "OTC max is 1200 mg/day. Prescription doses up to 2400 mg/day under medical supervision. Use lowest effective dose.",
    },
    {
        "aliases": ["diclofenac", "voveran", "voltaren", "voltarol", "cataflam"],
        "unit": "mg",
        "min_single": 25,
        "max_single": 75,
        "max_daily": 150,
        "typical_single": "50 mg",
        "typical_daily": "100–150 mg",
        "source": "WHO Model Formulary 2008, p. 28",
        "notes": "WHO max 150 mg/day. Use minimum effective dose for shortest duration due to cardiovascular and GI risks.",
    },
    {
        "aliases": ["naproxen", "naprosyn", "aleve"],
        "unit": "mg",
        "min_single": 125,
        "max_single": 1000,
        "max_daily": 1500,
        "typical_single": "250–500 mg",
        "typical_daily": "500–1000 mg",
        "source": "WHO Model Formulary 2008, p. 30",
        "notes": "OTC max 660 mg/day; prescription max 1500 mg/day.",
    },
    {
        "aliases": ["aspirin", "acetylsalicylic acid", "ecosprin", "disprin"],
        "unit": "mg",
        "min_single": 75,
        "max_single": 1000,
        "max_daily": 4000,
        "typical_single": "300–900 mg (analgesic); 75–150 mg (antiplatelet)",
        "typical_daily": "600–3000 mg (analgesic); 75–150 mg (antiplatelet)",
        "source": "WHO Model Formulary 2008, p. 26",
        "notes": "Antiplatelet dose 75–150 mg OD. Analgesic/antipyretic 300–1000 mg. Do not exceed 4 g/day.",
    },
    {
        "aliases": ["tramadol", "ultram", "tramazac"],
        "unit": "mg",
        "min_single": 25,
        "max_single": 100,
        "max_daily": 400,
        "typical_single": "50–100 mg",
        "typical_daily": "200–400 mg",
        "source": "WHO Model Formulary 2008, p. 27",
        "notes": "Do not exceed 400 mg/day. Reduce dose in elderly and renal impairment. Risk of serotonin syndrome.",
    },

    # ── Antibiotics ───────────────────────────────────────────────────────────
    {
        "aliases": ["amoxicillin", "amoxycillin", "mox", "novamox", "amoxil"],
        "unit": "mg",
        "min_single": 125,
        "max_single": 1000,
        "max_daily": 3000,
        "typical_single": "250–500 mg",
        "typical_daily": "750–3000 mg",
        "source": "WHO Model Formulary 2008, p. 131",
        "notes": "Standard infections 250–500 mg TDS. Severe infections up to 1 g TDS (3 g/day). Higher doses in specific indications.",
    },
    {
        "aliases": ["azithromycin", "azithral", "azee", "zithromax"],
        "unit": "mg",
        "min_single": 250,
        "max_single": 500,
        "max_daily": 500,
        "typical_single": "500 mg",
        "typical_daily": "500 mg",
        "source": "WHO Model Formulary 2008, p. 132",
        "notes": "Standard adult dose: 500 mg OD × 3 days or 500 mg day 1 then 250 mg days 2–5. Single daily dose; do not exceed 500 mg/day.",
    },
    {
        "aliases": ["ciprofloxacin", "cipro", "ciplox", "cifran"],
        "unit": "mg",
        "min_single": 100,
        "max_single": 750,
        "max_daily": 1500,
        "typical_single": "250–500 mg",
        "typical_daily": "500–1000 mg",
        "source": "WHO Model Formulary 2008, p. 134",
        "notes": "Max 750 mg per dose; 1500 mg/day. Severe/complicated infections up to 750 mg BD.",
    },
    {
        "aliases": ["metronidazole", "flagyl", "metrogyl"],
        "unit": "mg",
        "min_single": 200,
        "max_single": 800,
        "max_daily": 4000,
        "typical_single": "400–500 mg",
        "typical_daily": "1200–2400 mg",
        "source": "WHO Model Formulary 2008, p. 163",
        "notes": "Standard 400–500 mg TDS. Single-dose regimens (e.g. 2 g) used for specific indications (trichomoniasis). Max 4 g/day for short courses.",
    },
    {
        "aliases": ["doxycycline", "doxycap", "doxt"],
        "unit": "mg",
        "min_single": 50,
        "max_single": 200,
        "max_daily": 200,
        "typical_single": "100 mg",
        "typical_daily": "100–200 mg",
        "source": "WHO Model Formulary 2008, p. 136",
        "notes": "Loading dose 200 mg on day 1, then 100 mg OD. Do not exceed 200 mg/day.",
    },
    {
        "aliases": ["clarithromycin", "klaricid", "biaxin", "claribid"],
        "unit": "mg",
        "min_single": 125,
        "max_single": 500,
        "max_daily": 1000,
        "typical_single": "250–500 mg",
        "typical_daily": "500–1000 mg",
        "source": "WHO Model Formulary 2008, p. 133",
        "notes": "Standard 250–500 mg BD. Max 1 g/day. Extended-release 1 g OD for community-acquired pneumonia.",
    },

    # ── Antihypertensives ─────────────────────────────────────────────────────
    {
        "aliases": ["amlodipine", "norvasc", "amlokind", "stamlo", "amlopin"],
        "unit": "mg",
        "min_single": 2.5,
        "max_single": 10,
        "max_daily": 10,
        "typical_single": "5–10 mg",
        "typical_daily": "5–10 mg",
        "source": "WHO Model Formulary 2008, p. 248",
        "notes": "Once-daily dosing. Start 5 mg, max 10 mg/day. Do not exceed 10 mg/day.",
    },
    {
        "aliases": ["ramipril", "altace", "ramace", "cardace", "hopace"],
        "unit": "mg",
        "min_single": 1.25,
        "max_single": 10,
        "max_daily": 20,
        "typical_single": "2.5–10 mg",
        "typical_daily": "2.5–20 mg",
        "source": "WHO Model Formulary 2008, p. 251",
        "notes": "Start 1.25–2.5 mg OD. Max 10 mg OD (up to 20 mg/day in divided doses for heart failure).",
    },
    {
        "aliases": ["atenolol", "tenormin", "aten"],
        "unit": "mg",
        "min_single": 25,
        "max_single": 100,
        "max_daily": 200,
        "typical_single": "50–100 mg",
        "typical_daily": "50–100 mg",
        "source": "WHO Model Formulary 2008, p. 246",
        "notes": "Hypertension/angina: 50–100 mg OD. Max 200 mg/day in some indications.",
    },
    {
        "aliases": ["losartan", "cozaar", "losacar", "repace", "losar"],
        "unit": "mg",
        "min_single": 25,
        "max_single": 100,
        "max_daily": 100,
        "typical_single": "50–100 mg",
        "typical_daily": "50–100 mg",
        "source": "WHO Model Formulary 2008, p. 250",
        "notes": "Start 50 mg OD, max 100 mg/day. Reduce starting dose to 25 mg in volume depletion or hepatic impairment.",
    },
    {
        "aliases": ["telmisartan", "telma", "micardis", "telmikind"],
        "unit": "mg",
        "min_single": 20,
        "max_single": 80,
        "max_daily": 80,
        "typical_single": "40–80 mg",
        "typical_daily": "40–80 mg",
        "source": "WHO Essential Medicines List 23rd edition (2023)",
        "notes": "Once-daily dosing. Start 40 mg, max 80 mg/day.",
    },
    {
        "aliases": ["furosemide", "frusemide", "lasix", "frusenex"],
        "unit": "mg",
        "min_single": 20,
        "max_single": 80,
        "max_daily": 600,
        "typical_single": "20–80 mg",
        "typical_daily": "40–80 mg",
        "source": "WHO Model Formulary 2008, p. 313",
        "notes": "Oedema: 20–80 mg OD. Max 600 mg/day in refractory cases (under specialist supervision only).",
    },

    # ── Antidiabetics ─────────────────────────────────────────────────────────
    {
        "aliases": ["metformin", "glucophage", "glyciphage", "glycomet", "gluconorm"],
        "unit": "mg",
        "min_single": 500,
        "max_single": 1000,
        "max_daily": 3000,
        "typical_single": "500–1000 mg",
        "typical_daily": "1500–2550 mg",
        "source": "WHO Model Formulary 2008, p. 214",
        "notes": "Start 500 mg with meals; max 3 g/day in divided doses. Take with or after food to reduce GI side effects.",
    },
    {
        "aliases": ["glibenclamide", "glyburide", "daonil", "euglucon", "glucovance"],
        "unit": "mg",
        "min_single": 1.25,
        "max_single": 10,
        "max_daily": 20,
        "typical_single": "2.5–5 mg",
        "typical_daily": "5–20 mg",
        "source": "WHO Model Formulary 2008, p. 215",
        "notes": "Start 2.5–5 mg OD with breakfast. Max 20 mg/day. Doses >10 mg/day rarely provide additional benefit.",
    },
    {
        "aliases": ["glimepiride", "amaryl", "glimpid", "glimisave"],
        "unit": "mg",
        "min_single": 1,
        "max_single": 6,
        "max_daily": 8,
        "typical_single": "1–4 mg",
        "typical_daily": "1–8 mg",
        "source": "WHO Essential Medicines List 23rd edition (2023)",
        "notes": "Start 1 mg OD with first main meal. Max 8 mg/day; doses above 6 mg rarely more effective.",
    },
    {
        "aliases": ["glipizide", "minidiab", "glucotrol"],
        "unit": "mg",
        "min_single": 2.5,
        "max_single": 20,
        "max_daily": 40,
        "typical_single": "5–10 mg",
        "typical_daily": "5–40 mg",
        "source": "WHO Model Formulary 2008, p. 216",
        "notes": "Max 40 mg/day in divided doses. Doses above 15 mg/day should be given as divided doses.",
    },

    # ── Cardiovascular ────────────────────────────────────────────────────────
    {
        "aliases": ["atorvastatin", "lipitor", "atorva", "storvas", "atocor"],
        "unit": "mg",
        "min_single": 10,
        "max_single": 80,
        "max_daily": 80,
        "typical_single": "10–40 mg",
        "typical_daily": "10–80 mg",
        "source": "WHO Model Formulary 2008, p. 288",
        "notes": "Once-daily dosing. Start 10–20 mg. Max 80 mg/day. Higher doses increase myopathy risk.",
    },
    {
        "aliases": ["rosuvastatin", "crestor", "rozucor", "rosuvas"],
        "unit": "mg",
        "min_single": 5,
        "max_single": 40,
        "max_daily": 40,
        "typical_single": "10–20 mg",
        "typical_daily": "10–40 mg",
        "source": "WHO Essential Medicines List 23rd edition (2023)",
        "notes": "Once-daily dosing. Max 40 mg/day. Use 5 mg starting dose in Asian patients (increased plasma levels).",
    },
    {
        "aliases": ["digoxin", "lanoxin", "digicor"],
        "unit": "mcg",
        "min_single": 62.5,
        "max_single": 500,
        "max_daily": 500,
        "typical_single": "125–250 mcg",
        "typical_daily": "125–250 mcg",
        "source": "WHO Model Formulary 2008, p. 259",
        "notes": "Maintenance 125–250 mcg OD. Loading 0.75–1.5 mg in divided doses over 24h. Narrow therapeutic index; toxicity risk.",
    },
    {
        "aliases": ["amiodarone", "cordarone", "tachyra"],
        "unit": "mg",
        "min_single": 100,
        "max_single": 400,
        "max_daily": 1200,
        "typical_single": "200 mg",
        "typical_daily": "400–600 mg (loading); 100–200 mg (maintenance)",
        "source": "WHO Model Formulary 2008, p. 256",
        "notes": "Loading: 200 mg TDS × 1 week, then 200 mg BD × 1 week. Maintenance: 100–200 mg OD. Max loading 1200 mg/day.",
    },

    # ── Respiratory ───────────────────────────────────────────────────────────
    {
        "aliases": ["salbutamol", "albuterol", "ventolin", "asthalin", "salbetol"],
        "unit": "mg",
        "min_single": 2,
        "max_single": 8,
        "max_daily": 32,
        "typical_single": "2–4 mg",
        "typical_daily": "6–16 mg",
        "source": "WHO Model Formulary 2008, p. 310",
        "notes": "Oral tablets 2–4 mg TDS-QID. Max 8 mg single dose; 32 mg/day. Inhaled doses are in mcg and not validated here.",
    },
    {
        "aliases": ["montelukast", "singulair", "montair", "montec"],
        "unit": "mg",
        "min_single": 4,
        "max_single": 10,
        "max_daily": 10,
        "typical_single": "10 mg",
        "typical_daily": "10 mg",
        "source": "WHO Essential Medicines List 23rd edition (2023)",
        "notes": "Adults and adolescents ≥15 years: 10 mg OD. Do not exceed 10 mg/day.",
    },

    # ── Gastrointestinal ──────────────────────────────────────────────────────
    {
        "aliases": ["omeprazole", "omez", "ocid", "prilosec", "losec"],
        "unit": "mg",
        "min_single": 10,
        "max_single": 40,
        "max_daily": 80,
        "typical_single": "20–40 mg",
        "typical_daily": "20–40 mg",
        "source": "WHO Model Formulary 2008, p. 345",
        "notes": "Standard: 20–40 mg OD. Max 80 mg/day (Zollinger-Ellison syndrome may require up to 120 mg/day under specialist care).",
    },
    {
        "aliases": ["pantoprazole", "pan", "pantodac", "pantop", "protonix"],
        "unit": "mg",
        "min_single": 20,
        "max_single": 40,
        "max_daily": 80,
        "typical_single": "40 mg",
        "typical_daily": "40–80 mg",
        "source": "WHO Essential Medicines List 23rd edition (2023)",
        "notes": "Standard 40 mg OD. IV/high-dose regimens up to 80 mg BD under specialist supervision only.",
    },
    {
        "aliases": ["ondansetron", "zofran", "emeset", "ondem"],
        "unit": "mg",
        "min_single": 4,
        "max_single": 8,
        "max_daily": 24,
        "typical_single": "4–8 mg",
        "typical_daily": "8–24 mg",
        "source": "WHO Model Formulary 2008, p. 347",
        "notes": "Adults: 8 mg BD–TDS. Max 24 mg/day orally. Single IV dose max 32 mg withdrawn due to QT prolongation risk.",
    },
    {
        "aliases": ["domperidone", "domstal", "vomistop", "motilium"],
        "unit": "mg",
        "min_single": 10,
        "max_single": 10,
        "max_daily": 30,
        "typical_single": "10 mg",
        "typical_daily": "10–30 mg",
        "source": "WHO Model Formulary 2008, p. 344",
        "notes": "10 mg up to TDS. Max 30 mg/day. Use lowest effective dose for shortest duration due to cardiac risk.",
    },
    {
        "aliases": ["metoclopramide", "perinorm", "reglan", "maxolon"],
        "unit": "mg",
        "min_single": 5,
        "max_single": 10,
        "max_daily": 30,
        "typical_single": "10 mg",
        "typical_daily": "30 mg",
        "source": "WHO Model Formulary 2008, p. 346",
        "notes": "10 mg up to TDS. Max 30 mg/day (0.5 mg/kg/day). Use <5 days due to tardive dyskinesia risk.",
    },

    # ── CNS / psychiatry ──────────────────────────────────────────────────────
    {
        "aliases": ["sertraline", "zoloft", "sertima", "daxid", "zosert"],
        "unit": "mg",
        "min_single": 25,
        "max_single": 200,
        "max_daily": 200,
        "typical_single": "50–100 mg",
        "typical_daily": "50–200 mg",
        "source": "WHO Model Formulary 2008, p. 368",
        "notes": "Start 50 mg OD. May increase to 200 mg/day. Do not exceed 200 mg/day.",
    },
    {
        "aliases": ["fluoxetine", "prozac", "fludac", "oleanz"],
        "unit": "mg",
        "min_single": 10,
        "max_single": 60,
        "max_daily": 80,
        "typical_single": "20–40 mg",
        "typical_daily": "20–60 mg",
        "source": "WHO Model Formulary 2008, p. 366",
        "notes": "Start 20 mg OD. Max 60 mg/day for depression; 80 mg/day rarely used in OCD.",
    },
    {
        "aliases": ["diazepam", "valium", "calmpose", "placidox"],
        "unit": "mg",
        "min_single": 2,
        "max_single": 10,
        "max_daily": 30,
        "typical_single": "2–10 mg",
        "typical_daily": "4–30 mg",
        "source": "WHO Model Formulary 2008, p. 361",
        "notes": "Anxiety: 2–10 mg BD–QID. Max 30 mg/day. Use minimum effective dose for shortest duration (risk of dependence).",
    },

    # ── Anticoagulants ────────────────────────────────────────────────────────
    {
        "aliases": ["methotrexate", "mtx", "folitrax", "mexate"],
        "unit": "mg",
        "min_single": 2.5,
        "max_single": 25,
        "max_daily": 30,
        "typical_single": "7.5–25 mg (weekly)",
        "typical_daily": "7.5–25 mg once weekly",
        "source": "WHO Model Formulary 2008, p. 419",
        "notes": "WEEKLY dosing for RA/psoriasis. Daily dosing only in oncology protocols under specialist supervision. Do NOT exceed 25 mg/week for rheumatology use.",
    },
]


# ── Frequency → daily multiplier ─────────────────────────────────────────────

def _freq_multiplier(freq: str) -> int | None:
    """
    Convert a normalised frequency string to times-per-day.
    Returns None if the frequency cannot be determined.
    """
    f = freq.lower()
    if any(x in f for x in ["qid", "four times", "4 times", "1-1-1-1", "q6h"]):
        return 4
    if any(x in f for x in ["tds", "three times", "thrice", "3 times", "1-1-1",
                              "subah dopahar raat", "tid"]):
        return 3
    if any(x in f for x in ["bd", "twice", "two times", "2 times", "1-0-1",
                              "subah sham", "subah aur raat", "q12h", "bis"]):
        return 2
    if any(x in f for x in ["od", "once", "daily", "hs", "morning", "night",
                              "raat ko", "subah ko", "mane", "nocte", "q24h",
                              "ow", "once weekly", "weekly"]):
        return 1
    return None


# ── Dose parser ───────────────────────────────────────────────────────────────

_DOSE_RE = re.compile(
    r"""
    (?P<value> \d+(?:[.,]\d+)? )   # numeric value (integer or decimal)
    \s*
    (?P<unit>  mg | mcg | µg | ug | g | ml | units? )  # unit
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _parse_dose(dose_str: str) -> tuple[float, str] | tuple[None, None]:
    """
    Extract (value, normalised_unit) from a dose string.
    Returns (None, None) if parsing fails.
    Normalises: 'g' → 'mg' (×1000), 'µg'/'ug' → 'mcg'.
    """
    m = _DOSE_RE.search(dose_str)
    if not m:
        return None, None

    value = float(m.group("value").replace(",", "."))
    unit  = m.group("unit").lower()

    if unit == "g":
        value *= 1000
        unit   = "mg"
    elif unit in ("µg", "ug"):
        unit = "mcg"

    return value, unit


# ── Matching engine ───────────────────────────────────────────────────────────

def _find_entry(drug_name: str) -> dict | None:
    dn = re.sub(r"[^a-z0-9 ]", "", drug_name.lower()).strip()
    for entry in _DOSE_TABLE:
        if any(dn == a or dn in a or a in dn for a in entry["aliases"]):
            return entry
    return None


# ── Public API ────────────────────────────────────────────────────────────────

def validate_dose(drug: str, dose_str: str, frequency: str = "") -> dict:
    """
    Validate the extracted dose for a single medicine.

    Args:
        drug      : drug name from NER
        dose_str  : dose string from NER (e.g. "650 mg", "80 mg")
        frequency : normalised frequency string (e.g. "BD", "TDS", "OD")
                    used to estimate daily dose; ignored if empty

    Returns:
        {
          "drug":           str,
          "extracted_dose": str,
          "warnings": [
            {
              "type":        "exceeds_single" | "exceeds_daily" | "below_minimum",
              "severity":    "high" | "moderate",
              "message":     str,
              "who_limit":   str,
              "source":      str,
            }
          ],
          "who_reference": {
            "typical_single": str,
            "typical_daily":  str,
            "notes":          str,
            "source":         str,
          } | None
        }
    """
    result = {
        "drug":           drug,
        "extracted_dose": dose_str,
        "warnings":       [],
        "who_reference":  None,
    }

    entry = _find_entry(drug)
    if entry is None:
        return result   # Drug not in table — skip silently

    result["who_reference"] = {
        "typical_single": entry["typical_single"],
        "typical_daily":  entry["typical_daily"],
        "notes":          entry["notes"],
        "source":         entry["source"],
    }

    value, unit = _parse_dose(dose_str)
    if value is None:
        return result   # Cannot parse dose — skip silently

    ref_unit = entry["unit"]

    # Unit mismatch (e.g. mg drug prescribed in mcg) — can't compare safely
    if unit != ref_unit:
        return result

    # ── Check 1: below minimum ──────────────────────────────────────────────
    if entry.get("min_single") and value < entry["min_single"]:
        result["warnings"].append({
            "type":      "below_minimum",
            "severity":  "moderate",
            "message":   (
                f"{drug}: prescribed dose {dose_str} is below the WHO minimum "
                f"single dose of {entry['min_single']} {ref_unit}. "
                f"Verify for sub-therapeutic dosing or transcription error."
            ),
            "who_limit": f"Min single dose: {entry['min_single']} {ref_unit}",
            "source":    entry["source"],
        })

    # ── Check 2: exceeds max single dose ────────────────────────────────────
    if entry.get("max_single") and value > entry["max_single"]:
        result["warnings"].append({
            "type":      "exceeds_single",
            "severity":  "high",
            "message":   (
                f"{drug}: prescribed dose {dose_str} exceeds the WHO maximum "
                f"single dose of {entry['max_single']} {ref_unit}. "
                f"Typical range: {entry['typical_single']}."
            ),
            "who_limit": f"Max single dose: {entry['max_single']} {ref_unit}",
            "source":    entry["source"],
        })

    # ── Check 3: exceeds max daily dose (requires frequency) ────────────────
    if frequency and entry.get("max_daily"):
        mult = _freq_multiplier(frequency)
        if mult is not None:
            est_daily = value * mult
            if est_daily > entry["max_daily"]:
                result["warnings"].append({
                    "type":      "exceeds_daily",
                    "severity":  "high",
                    "message":   (
                        f"{drug}: estimated daily dose {dose_str} × {mult}/day "
                        f"= {est_daily:.0f} {ref_unit} exceeds WHO maximum daily "
                        f"dose of {entry['max_daily']} {ref_unit}. "
                        f"Typical daily: {entry['typical_daily']}."
                    ),
                    "who_limit": f"Max daily dose: {entry['max_daily']} {ref_unit}",
                    "source":    entry["source"],
                })

    return result


def validate_prescription(medicines: list[dict]) -> list[dict]:
    """
    Run validate_dose() for every medicine in the prescription.
    Returns only entries that have at least one warning
    (entries for unknown drugs or clean doses are dropped).
    """
    results = []
    for m in medicines:
        r = validate_dose(
            drug      = m.get("drug",      ""),
            dose_str  = m.get("dose",      ""),
            frequency = m.get("frequency", ""),
        )
        if r["warnings"]:     # only include medicines with warnings
            results.append(r)
    return results
