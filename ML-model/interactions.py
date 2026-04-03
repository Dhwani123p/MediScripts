"""
MediScript — Drug-drug interaction checker
Uses a curated local table of clinically significant interactions drawn from
standard pharmacology references (DrugBank, BNF, CIMS India).
RxNorm is used only to normalise drug name variants to canonical form.

Why local table?
  The RxNav /interaction endpoint has been discontinued.
  A curated table is faster, works offline, and is easier to audit clinically.
"""

import re
import logging
import requests

log = logging.getLogger("mediscript.interactions")

_RXNAV      = "https://rxnav.nlm.nih.gov/REST"
_TIMEOUT    = 5
_SESSION    = requests.Session()
_SESSION.headers.update({"Accept": "application/json"})


# ── Canonical name lookup via RxNorm ─────────────────────────────────────────
# RxNorm resolves brand/generic/spelling variants → canonical ingredient name.
# Used to normalise what comes out of NER before table lookup.

def _canonical(drug_name: str) -> str:
    """
    Return the canonical RxNorm ingredient name for drug_name.
    Falls back to the original name (lowercased) on any error.
    """
    try:
        r = _SESSION.get(
            f"{_RXNAV}/rxcui.json",
            params={"name": drug_name, "search": 1},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        cuis = r.json().get("idGroup", {}).get("rxnormId", [])
        if not cuis:
            return drug_name.lower()
        # Resolve CUI → canonical name
        r2 = _SESSION.get(f"{_RXNAV}/rxcui/{cuis[0]}/properties.json", timeout=_TIMEOUT)
        r2.raise_for_status()
        name = r2.json().get("properties", {}).get("name", "")
        return name.lower() if name else drug_name.lower()
    except Exception:
        return drug_name.lower()


# ── Interaction table ─────────────────────────────────────────────────────────
# Each entry: (frozenset of drug-A aliases, frozenset of drug-B aliases,
#              severity, description, mechanism)
#
# Aliases are lowercase; matching is substring-aware so "warfarin" catches
# "warfarin sodium" etc.
#
# Severity levels: "high" | "moderate" | "low"
#
# Sources: DrugBank, BNF 2024, CIMS India, Medscape Drug Interactions

_TABLE: list[tuple] = [

    # ── Anticoagulants ────────────────────────────────────────────────────────
    (
        {"warfarin", "acenocoumarol", "coumadin"},
        {"aspirin", "acetylsalicylic acid", "asa"},
        "high",
        "Warfarin + Aspirin: significantly increased risk of bleeding. Aspirin inhibits platelet aggregation and can cause GI mucosal damage, compounding the anticoagulant effect.",
    ),
    (
        {"warfarin", "acenocoumarol", "coumadin"},
        {"ibuprofen", "naproxen", "diclofenac", "celecoxib", "mefenamic acid", "nimesulide", "ketorolac"},
        "high",
        "Warfarin + NSAID: NSAIDs inhibit platelet function and can cause GI bleeding; combined with warfarin this creates a high risk of serious haemorrhage.",
    ),
    (
        {"warfarin", "acenocoumarol"},
        {"metronidazole", "flagyl"},
        "high",
        "Warfarin + Metronidazole: metronidazole inhibits CYP2C9 (warfarin's primary metabolic pathway), causing a marked rise in INR and bleeding risk.",
    ),
    (
        {"warfarin", "acenocoumarol"},
        {"fluconazole", "itraconazole", "ketoconazole", "voriconazole"},
        "high",
        "Warfarin + Azole antifungal: azoles inhibit CYP2C9/3A4, increasing warfarin plasma levels and INR substantially.",
    ),
    (
        {"warfarin", "acenocoumarol"},
        {"ciprofloxacin", "levofloxacin", "norfloxacin", "ofloxacin"},
        "moderate",
        "Warfarin + Fluoroquinolone: fluoroquinolones inhibit warfarin metabolism and reduce vitamin-K-producing gut flora, enhancing anticoagulant effect.",
    ),
    (
        {"warfarin", "acenocoumarol"},
        {"amoxicillin", "ampicillin", "azithromycin", "clarithromycin", "doxycycline", "tetracycline"},
        "moderate",
        "Warfarin + Antibiotic: broad-spectrum antibiotics reduce gut flora that produce vitamin K2, potentially increasing anticoagulant effect.",
    ),
    (
        {"warfarin", "acenocoumarol"},
        {"amiodarone"},
        "high",
        "Warfarin + Amiodarone: amiodarone is a potent CYP2C9 inhibitor with a very long half-life; can double INR and cause severe bleeding even weeks after starting.",
    ),

    # ── Antiplatelets ─────────────────────────────────────────────────────────
    (
        {"aspirin", "acetylsalicylic acid"},
        {"clopidogrel", "prasugrel", "ticagrelor"},
        "moderate",
        "Dual antiplatelet therapy (Aspirin + Clopidogrel/Ticagrelor): significantly increased bleeding risk; this combination is used intentionally in ACS but requires close monitoring.",
    ),
    (
        {"aspirin", "acetylsalicylic acid"},
        {"ibuprofen", "naproxen", "diclofenac"},
        "moderate",
        "Aspirin + NSAID: NSAIDs can block aspirin's irreversible platelet COX-1 inhibition, reducing its cardioprotective effect and increasing GI bleeding risk.",
    ),

    # ── MAO Inhibitors ────────────────────────────────────────────────────────
    (
        {"selegiline", "phenelzine", "tranylcypromine", "isocarboxazid", "moclobemide"},
        {"tramadol", "pethidine", "fentanyl", "meperidine"},
        "high",
        "MAOI + Opioid (esp. tramadol/pethidine): risk of serotonin syndrome and/or excitatory reactions; potentially fatal. Avoid combination.",
    ),
    (
        {"selegiline", "phenelzine", "tranylcypromine", "isocarboxazid", "moclobemide"},
        {"sertraline", "fluoxetine", "paroxetine", "escitalopram", "citalopram", "fluvoxamine"},
        "high",
        "MAOI + SSRI: severe serotonin syndrome risk (agitation, hyperthermia, myoclonus, seizures). At minimum 14 days washout required between agents.",
    ),
    (
        {"selegiline", "phenelzine", "tranylcypromine", "moclobemide"},
        {"pseudoephedrine", "ephedrine", "phenylephrine"},
        "high",
        "MAOI + Sympathomimetic: risk of hypertensive crisis due to massive catecholamine release.",
    ),

    # ── Serotonin syndrome ────────────────────────────────────────────────────
    (
        {"sertraline", "fluoxetine", "paroxetine", "escitalopram", "citalopram"},
        {"tramadol"},
        "high",
        "SSRI + Tramadol: tramadol inhibits serotonin reuptake; combination raises serotonin syndrome risk (tachycardia, hyperthermia, agitation, clonus).",
    ),
    (
        {"sertraline", "fluoxetine", "paroxetine", "escitalopram", "citalopram"},
        {"linezolid"},
        "high",
        "SSRI + Linezolid: linezolid is a reversible MAOI; combination can precipitate serotonin syndrome.",
    ),
    (
        {"sertraline", "fluoxetine", "paroxetine", "escitalopram", "citalopram"},
        {"sumatriptan", "rizatriptan", "zolmitriptan", "naratriptan"},
        "moderate",
        "SSRI + Triptan: additive serotonergic effect; weak serotonin syndrome risk. Monitor for dizziness, tremor, agitation.",
    ),

    # ── QT prolongation ───────────────────────────────────────────────────────
    (
        {"azithromycin", "clarithromycin", "erythromycin"},
        {"amiodarone", "sotalol", "dronedarone"},
        "high",
        "Macrolide + Antiarrhythmic: additive QT prolongation; risk of torsades de pointes and sudden cardiac death.",
    ),
    (
        {"azithromycin", "clarithromycin", "erythromycin"},
        {"haloperidol", "quetiapine", "risperidone", "olanzapine", "ziprasidone"},
        "moderate",
        "Macrolide + Antipsychotic: both drug classes prolong QT interval; combination increases arrhythmia risk.",
    ),
    (
        {"ciprofloxacin", "levofloxacin", "moxifloxacin"},
        {"amiodarone", "sotalol"},
        "high",
        "Fluoroquinolone + Antiarrhythmic: additive QT prolongation; risk of life-threatening ventricular arrhythmia.",
    ),
    (
        {"ciprofloxacin", "levofloxacin", "moxifloxacin"},
        {"haloperidol", "quetiapine", "risperidone"},
        "moderate",
        "Fluoroquinolone + Antipsychotic: additive QT-prolonging effect; monitor ECG.",
    ),
    (
        {"ondansetron", "granisetron", "domperidone"},
        {"amiodarone", "sotalol", "azithromycin", "ciprofloxacin"},
        "moderate",
        "5-HT3 antagonist/Prokinetic + QT-prolonging drug: combined QT prolongation risk; domperidone carries a class warning for arrhythmia.",
    ),

    # ── CNS depressants ───────────────────────────────────────────────────────
    (
        {"diazepam", "lorazepam", "alprazolam", "clonazepam", "nitrazepam", "midazolam"},
        {"morphine", "codeine", "tramadol", "oxycodone", "fentanyl", "buprenorphine", "hydrocodone"},
        "high",
        "Benzodiazepine + Opioid: profound CNS and respiratory depression; risk of fatal respiratory arrest. This combination carries a boxed FDA warning.",
    ),
    (
        {"diazepam", "lorazepam", "alprazolam", "clonazepam", "nitrazepam"},
        {"alcohol", "ethanol", "zolpidem", "zopiclone", "eszopiclone"},
        "high",
        "Benzodiazepine + CNS depressant: additive sedation and respiratory depression; avoid concurrent use.",
    ),
    (
        {"gabapentin", "pregabalin"},
        {"morphine", "codeine", "tramadol", "oxycodone"},
        "moderate",
        "Gabapentinoid + Opioid: synergistic respiratory depression; several fatal overdose cases reported.",
    ),

    # ── Antidiabetics ─────────────────────────────────────────────────────────
    (
        {"metformin", "glucophage"},
        {"contrast", "iodinated contrast", "iohexol", "iodixanol"},
        "high",
        "Metformin + Iodinated Contrast: contrast-induced nephropathy can reduce metformin excretion, increasing lactic acidosis risk. Metformin should be withheld 48h before and after contrast.",
    ),
    (
        {"glibenclamide", "glipizide", "gliclazide", "glimepiride", "gliquidone"},
        {"fluconazole", "miconazole", "voriconazole"},
        "high",
        "Sulfonylurea + Azole antifungal: azoles inhibit CYP2C9, markedly raising sulfonylurea levels; risk of severe prolonged hypoglycaemia.",
    ),
    (
        {"insulin", "glibenclamide", "glipizide", "gliclazide"},
        {"propranolol", "atenolol", "metoprolol", "bisoprolol"},
        "moderate",
        "Antidiabetic + Beta-blocker: beta-blockers mask tachycardia (early hypoglycaemia warning) and can prolong hypoglycaemic episodes.",
    ),

    # ── Antihypertensives ─────────────────────────────────────────────────────
    (
        {"ramipril", "enalapril", "lisinopril", "perindopril", "telmisartan", "losartan", "valsartan"},
        {"potassium", "spironolactone", "eplerenone", "amiloride"},
        "high",
        "ACE inhibitor/ARB + Potassium-sparing agent: additive hyperkalaemia risk; can cause fatal cardiac arrhythmia. Monitor serum potassium closely.",
    ),
    (
        {"sildenafil", "tadalafil", "vardenafil"},
        {"nitroglycerine", "isosorbide mononitrate", "isosorbide dinitrate", "amyl nitrite"},
        "high",
        "PDE5 inhibitor + Nitrate: profound synergistic hypotension; can cause fatal cardiovascular collapse. Combination is absolutely contraindicated.",
    ),
    (
        {"amlodipine", "diltiazem", "verapamil"},
        {"simvastatin", "lovastatin", "atorvastatin"},
        "moderate",
        "Calcium channel blocker (non-DHP) + Statin: diltiazem/verapamil inhibit CYP3A4, raising statin levels and increasing myopathy/rhabdomyolysis risk.",
    ),

    # ── Statins ───────────────────────────────────────────────────────────────
    (
        {"simvastatin", "lovastatin", "atorvastatin", "rosuvastatin"},
        {"clarithromycin", "erythromycin", "itraconazole", "ketoconazole"},
        "high",
        "Statin + CYP3A4 inhibitor: dramatically increases statin plasma concentrations; high risk of myopathy and rhabdomyolysis.",
    ),
    (
        {"simvastatin", "lovastatin"},
        {"amiodarone"},
        "high",
        "Simvastatin + Amiodarone: amiodarone inhibits CYP3A4; simvastatin dose should not exceed 20 mg when co-prescribed.",
    ),

    # ── Antibiotics ───────────────────────────────────────────────────────────
    (
        {"metronidazole", "tinidazole"},
        {"alcohol", "ethanol"},
        "high",
        "Metronidazole + Alcohol: disulfiram-like reaction (flushing, vomiting, tachycardia, hypotension). Avoid alcohol during and 48h after treatment.",
    ),
    (
        {"ciprofloxacin", "levofloxacin", "norfloxacin"},
        {"theophylline", "aminophylline"},
        "high",
        "Fluoroquinolone + Theophylline: fluoroquinolones markedly inhibit CYP1A2, raising theophylline levels; risk of theophylline toxicity (seizures, arrhythmia).",
    ),
    (
        {"rifampicin", "rifampin"},
        {"warfarin", "acenocoumarol"},
        "high",
        "Rifampicin + Warfarin: rifampicin is a powerful CYP inducer; drastically reduces warfarin levels, causing loss of anticoagulant effect.",
    ),
    (
        {"rifampicin", "rifampin"},
        {"oral contraceptive", "ethinylestradiol", "levonorgestrel", "norethisterone"},
        "high",
        "Rifampicin + Oral contraceptive: rifampicin induces hepatic enzymes, reducing oestrogen/progestogen levels and causing contraceptive failure.",
    ),
    (
        {"doxycycline", "tetracycline", "minocycline"},
        {"antacid", "calcium carbonate", "aluminium hydroxide", "magnesium hydroxide"},
        "moderate",
        "Tetracycline + Antacid/Calcium: divalent/trivalent cations chelate tetracyclines in the gut, reducing absorption by up to 90%.",
    ),

    # ── Antiepileptics ────────────────────────────────────────────────────────
    (
        {"phenytoin", "carbamazepine", "phenobarbitone", "phenobarbital"},
        {"oral contraceptive", "ethinylestradiol", "levonorgestrel"},
        "high",
        "Enzyme-inducing antiepileptic + OCP: significantly reduces contraceptive steroid levels, increasing unintended pregnancy risk.",
    ),
    (
        {"valproate", "sodium valproate", "valproic acid"},
        {"lamotrigine"},
        "moderate",
        "Valproate + Lamotrigine: valproate inhibits lamotrigine glucuronidation, doubling lamotrigine levels; risk of rash (including Stevens-Johnson syndrome) and toxicity.",
    ),
    (
        {"carbamazepine"},
        {"clarithromycin", "erythromycin", "verapamil", "diltiazem"},
        "high",
        "Carbamazepine + CYP3A4 inhibitor: raises carbamazepine levels causing toxicity (diplopia, ataxia, nausea).",
    ),

    # ── Immunosuppressants ────────────────────────────────────────────────────
    (
        {"ciclosporin", "cyclosporine", "tacrolimus"},
        {"ibuprofen", "naproxen", "diclofenac", "nimesulide"},
        "high",
        "Calcineurin inhibitor + NSAID: NSAIDs reduce renal prostaglandins, potentiating calcineurin inhibitor nephrotoxicity.",
    ),
    (
        {"methotrexate"},
        {"aspirin", "ibuprofen", "naproxen", "diclofenac"},
        "high",
        "Methotrexate + NSAID: NSAIDs reduce renal tubular secretion of methotrexate, causing dangerous drug accumulation and haematological/GI toxicity.",
    ),
    (
        {"methotrexate"},
        {"trimethoprim", "co-trimoxazole", "cotrimoxazole"},
        "high",
        "Methotrexate + Trimethoprim: additive folate antagonism; significantly increases bone marrow suppression risk.",
    ),

    # ── Cardiac glycosides ────────────────────────────────────────────────────
    (
        {"digoxin"},
        {"amiodarone"},
        "high",
        "Digoxin + Amiodarone: amiodarone raises digoxin levels by ~70% by inhibiting P-glycoprotein and reducing renal clearance; risk of digoxin toxicity.",
    ),
    (
        {"digoxin"},
        {"furosemide", "hydrochlorothiazide", "chlorthalidone"},
        "moderate",
        "Digoxin + Loop/Thiazide diuretic: diuretic-induced hypokalaemia sensitises the myocardium to digoxin toxicity (arrhythmias).",
    ),
    (
        {"digoxin"},
        {"clarithromycin", "erythromycin", "azithromycin"},
        "moderate",
        "Digoxin + Macrolide: macrolides eradicate gut flora that metabolise digoxin, raising plasma levels; also P-gp inhibition with clarithromycin.",
    ),

    # ── Lithium ───────────────────────────────────────────────────────────────
    (
        {"lithium", "lithium carbonate", "lithium citrate"},
        {"ibuprofen", "naproxen", "diclofenac", "nimesulide"},
        "high",
        "Lithium + NSAID: NSAIDs reduce renal lithium clearance, causing lithium toxicity (tremor, ataxia, confusion, seizures).",
    ),
    (
        {"lithium", "lithium carbonate"},
        {"ramipril", "enalapril", "lisinopril", "hydrochlorothiazide", "furosemide"},
        "high",
        "Lithium + ACE inhibitor/Diuretic: sodium depletion causes compensatory lithium retention; risk of lithium toxicity.",
    ),

    # ── Proton pump inhibitors ────────────────────────────────────────────────
    (
        {"omeprazole", "esomeprazole"},
        {"clopidogrel"},
        "moderate",
        "Omeprazole/Esomeprazole + Clopidogrel: omeprazole inhibits CYP2C19-mediated bioactivation of clopidogrel, reducing antiplatelet effect by ~40%. Pantoprazole is preferred if a PPI is needed.",
    ),

    # ── Antimalarials / antiprotozoals ────────────────────────────────────────
    (
        {"chloroquine", "hydroxychloroquine"},
        {"amiodarone", "sotalol", "haloperidol", "domperidone"},
        "high",
        "Chloroquine/HCQ + QT-prolonging drug: additive QT prolongation; risk of ventricular arrhythmia.",
    ),
]


# ── Matching engine ───────────────────────────────────────────────────────────

def _norm(name: str) -> str:
    """Lowercase and strip punctuation for fuzzy matching."""
    return re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()


def _matches(name: str, alias_set: frozenset) -> bool:
    """Return True if the normalised drug name contains any alias as a substring."""
    n = _norm(name)
    return any(alias in n or n in alias for alias in alias_set)


def check_interactions(drug_names: list[str]) -> list[dict]:
    """
    Given a list of extracted drug names, return all known interactions.

    Returns [] when fewer than 2 drugs are supplied.

    Each returned dict:
      {
        "drugs":       ["Warfarin", "Aspirin"],   # original names from NER
        "severity":    "high",                    # "high" | "moderate" | "low"
        "description": "...",
        "source":      "MediScript Clinical DB"
      }
    """
    if len(drug_names) < 2:
        return []

    results = []
    # Check every pair
    for i in range(len(drug_names)):
        for j in range(i + 1, len(drug_names)):
            a, b = drug_names[i], drug_names[j]
            for alias_a, alias_b, severity, description in _TABLE:
                hit_a = _matches(a, alias_a) and _matches(b, alias_b)
                hit_b = _matches(b, alias_a) and _matches(a, alias_b)
                if hit_a or hit_b:
                    results.append({
                        "drugs":       [a, b],
                        "severity":    severity,
                        "description": description,
                        "source":      "MediScript Clinical DB",
                    })
                    break   # one match per pair is enough

    return results
