"""
MediScript — Cross-border drug name mapper
Converts a drug name from the prescribing country (typically India)
to the equivalent approved name in the patient's country.

Bridge: local name → WHO INN (International Nonproprietary Name)
        → target country name + common brand examples

Covers ~95% of drugs routinely prescribed in Indian telemedicine.
Country codes follow ISO 3166-1 alpha-2.
"""

import re

# ── Master table ──────────────────────────────────────────────────────────────
# Structure:
#   INN (str) → {
#       "aliases": [other names this drug is known by, all lowercase],
#       "countries": {
#           country_code: {
#               "name":   official approved name in that country,
#               "brands": [common brand names],
#               "note":   optional clinical/regulatory note,
#           }
#       }
#   }
#
# "IN" entry = India (source language / prescriber's country).
# Absence of a country key means the INN name is used there unchanged.

_TABLE: dict[str, dict] = {

    # ── Analgesics / antipyretics ─────────────────────────────────────────────
    "paracetamol": {
        "aliases": ["acetaminophen", "paracetamol", "p'mol", "crocin", "dolo", "calpol"],
        "countries": {
            "IN": {"name": "Paracetamol",    "brands": ["Crocin", "Dolo 650", "Calpol"]},
            "US": {"name": "Acetaminophen",  "brands": ["Tylenol", "Panadol", "FeverAll"],
                   "note": "USA uses USAN name 'Acetaminophen'; same molecule."},
            "GB": {"name": "Paracetamol",    "brands": ["Panadol", "Calpol"]},
            "AU": {"name": "Paracetamol",    "brands": ["Panadol", "Panamax"]},
            "CA": {"name": "Acetaminophen",  "brands": ["Tylenol", "Tempra"]},
            "DE": {"name": "Paracetamol",    "brands": ["ben-u-ron", "Paracetamol Stada"]},
            "FR": {"name": "Paracétamol",    "brands": ["Doliprane", "Efferalgan"]},
            "AE": {"name": "Paracetamol",    "brands": ["Panadol", "Adol"]},
            "SA": {"name": "Paracetamol",    "brands": ["Panadol", "Adol"]},
        },
    },
    "ibuprofen": {
        "aliases": ["ibuprofen", "brufen", "combiflam"],
        "countries": {
            "IN": {"name": "Ibuprofen",  "brands": ["Brufen", "Ibugesic", "Combiflam"]},
            "US": {"name": "Ibuprofen",  "brands": ["Advil", "Motrin"]},
            "GB": {"name": "Ibuprofen",  "brands": ["Nurofen", "Brufen"]},
            "DE": {"name": "Ibuprofen",  "brands": ["Nurofen", "Dolgit"]},
            "AE": {"name": "Ibuprofen",  "brands": ["Brufen", "Nurofen"]},
        },
    },
    "diclofenac": {
        "aliases": ["diclofenac", "voveran", "voltaren", "voltarol"],
        "countries": {
            "IN": {"name": "Diclofenac", "brands": ["Voveran", "Voltaren"]},
            "US": {"name": "Diclofenac", "brands": ["Voltaren", "Cambia"],
                   "note": "Oral diclofenac has limited OTC availability in USA."},
            "GB": {"name": "Diclofenac", "brands": ["Voltarol"]},
            "DE": {"name": "Diclofenac", "brands": ["Voltaren", "Diclac"]},
            "AE": {"name": "Diclofenac", "brands": ["Voltaren", "Cataflam"]},
        },
    },
    "tramadol": {
        "aliases": ["tramadol", "ultram", "tramazac"],
        "countries": {
            "IN": {"name": "Tramadol",  "brands": ["Tramazac", "Ultram"]},
            "US": {"name": "Tramadol",  "brands": ["Ultram", "ConZip"],
                   "note": "Schedule IV controlled substance in USA."},
            "GB": {"name": "Tramadol",  "brands": ["Zydol", "Tramquel"],
                   "note": "Class C controlled drug in UK."},
            "DE": {"name": "Tramadol",  "brands": ["Tramal"]},
            "AE": {"name": "Tramadol",  "brands": ["Tramal"],
                   "note": "Requires special permit in UAE; verify legality."},
        },
    },

    # ── Antibiotics ───────────────────────────────────────────────────────────
    "amoxicillin": {
        "aliases": ["amoxicillin", "amoxycillin", "mox", "novamox"],
        "countries": {
            "IN": {"name": "Amoxicillin", "brands": ["Mox", "Novamox", "Amoxil"]},
            "US": {"name": "Amoxicillin", "brands": ["Amoxil", "Trimox"]},
            "GB": {"name": "Amoxicillin", "brands": ["Amoxil"]},
            "DE": {"name": "Amoxicillin", "brands": ["Amoxypen", "Infectomox"]},
            "AE": {"name": "Amoxicillin", "brands": ["Amoxil", "Trimox"]},
        },
    },
    "azithromycin": {
        "aliases": ["azithromycin", "zithromax", "azithral", "azee"],
        "countries": {
            "IN": {"name": "Azithromycin", "brands": ["Azithral", "Azee", "Zithromax"]},
            "US": {"name": "Azithromycin", "brands": ["Zithromax", "Z-Pak"]},
            "GB": {"name": "Azithromycin", "brands": ["Zithromax"]},
            "DE": {"name": "Azithromycin", "brands": ["Zithromax", "Ultreon"]},
            "AE": {"name": "Azithromycin", "brands": ["Zithromax"]},
        },
    },
    "ciprofloxacin": {
        "aliases": ["ciprofloxacin", "cipro", "ciplox"],
        "countries": {
            "IN": {"name": "Ciprofloxacin", "brands": ["Ciplox", "Cifran"]},
            "US": {"name": "Ciprofloxacin", "brands": ["Cipro"]},
            "GB": {"name": "Ciprofloxacin", "brands": ["Ciproxin"]},
            "DE": {"name": "Ciprofloxacin", "brands": ["Ciprobay"]},
            "AE": {"name": "Ciprofloxacin", "brands": ["Cipro", "Ciflox"]},
        },
    },
    "metronidazole": {
        "aliases": ["metronidazole", "flagyl", "metrogyl"],
        "countries": {
            "IN": {"name": "Metronidazole", "brands": ["Flagyl", "Metrogyl"]},
            "US": {"name": "Metronidazole", "brands": ["Flagyl"]},
            "GB": {"name": "Metronidazole", "brands": ["Flagyl"]},
            "DE": {"name": "Metronidazol",  "brands": ["Flagyl", "Clont"]},
            "AE": {"name": "Metronidazole", "brands": ["Flagyl"]},
        },
    },
    "doxycycline": {
        "aliases": ["doxycycline", "doxycap", "doxt"],
        "countries": {
            "IN": {"name": "Doxycycline", "brands": ["Doxycap", "Doxt-SL"]},
            "US": {"name": "Doxycycline", "brands": ["Vibramycin", "Doryx"]},
            "GB": {"name": "Doxycycline", "brands": ["Vibramycin"]},
            "DE": {"name": "Doxycyclin",  "brands": ["Vibramycin", "Doxybene"]},
            "AE": {"name": "Doxycycline", "brands": ["Vibramycin"]},
        },
    },

    # ── Antihypertensives ─────────────────────────────────────────────────────
    "amlodipine": {
        "aliases": ["amlodipine", "norvasc", "amlokind", "stamlo"],
        "countries": {
            "IN": {"name": "Amlodipine", "brands": ["Amlokind", "Stamlo", "Amlopin"]},
            "US": {"name": "Amlodipine", "brands": ["Norvasc"]},
            "GB": {"name": "Amlodipine", "brands": ["Istin"]},
            "DE": {"name": "Amlodipin",  "brands": ["Norvasc", "Amlodipin Stada"]},
            "AE": {"name": "Amlodipine", "brands": ["Norvasc", "Amlopres"]},
        },
    },
    "ramipril": {
        "aliases": ["ramipril", "altace", "ramace", "cardace"],
        "countries": {
            "IN": {"name": "Ramipril", "brands": ["Cardace", "Ramace"]},
            "US": {"name": "Ramipril", "brands": ["Altace"]},
            "GB": {"name": "Ramipril", "brands": ["Tritace"]},
            "DE": {"name": "Ramipril", "brands": ["Delix", "Vesdil"]},
            "AE": {"name": "Ramipril", "brands": ["Tritace", "Altace"]},
        },
    },
    "atenolol": {
        "aliases": ["atenolol", "tenormin", "aten"],
        "countries": {
            "IN": {"name": "Atenolol", "brands": ["Aten", "Tenormin"]},
            "US": {"name": "Atenolol", "brands": ["Tenormin"]},
            "GB": {"name": "Atenolol", "brands": ["Tenormin"]},
            "DE": {"name": "Atenolol", "brands": ["Tenormin", "Atenolol ratiopharm"]},
            "AE": {"name": "Atenolol", "brands": ["Tenormin"]},
        },
    },
    "losartan": {
        "aliases": ["losartan", "cozaar", "losacar", "repace"],
        "countries": {
            "IN": {"name": "Losartan", "brands": ["Losacar", "Repace", "Losar"]},
            "US": {"name": "Losartan", "brands": ["Cozaar"]},
            "GB": {"name": "Losartan", "brands": ["Cozaar"]},
            "DE": {"name": "Losartan", "brands": ["Lorzaar", "Losartan Stada"]},
            "AE": {"name": "Losartan", "brands": ["Cozaar"]},
        },
    },
    "telmisartan": {
        "aliases": ["telmisartan", "telma", "micardis"],
        "countries": {
            "IN": {"name": "Telmisartan", "brands": ["Telma", "Telmikind"]},
            "US": {"name": "Telmisartan", "brands": ["Micardis"]},
            "GB": {"name": "Telmisartan", "brands": ["Micardis"]},
            "DE": {"name": "Telmisartan", "brands": ["Micardis", "Kinzal"]},
            "AE": {"name": "Telmisartan", "brands": ["Micardis"]},
        },
    },
    "furosemide": {
        "aliases": ["furosemide", "frusemide", "lasix", "frusenex"],
        "countries": {
            "IN": {"name": "Furosemide",  "brands": ["Lasix", "Frusenex"],
                   "note": "Previously called Frusemide in India; now aligned with INN."},
            "US": {"name": "Furosemide",  "brands": ["Lasix"]},
            "GB": {"name": "Furosemide",  "brands": ["Lasix"],
                   "note": "UK replaced 'Frusemide' with 'Furosemide' in 2003."},
            "DE": {"name": "Furosemid",   "brands": ["Lasix", "Furosemid ratiopharm"]},
            "AE": {"name": "Furosemide",  "brands": ["Lasix"]},
        },
    },

    # ── Antidiabetics ─────────────────────────────────────────────────────────
    "metformin": {
        "aliases": ["metformin", "glucophage", "glyciphage", "glycomet"],
        "countries": {
            "IN": {"name": "Metformin",  "brands": ["Glyciphage", "Glucophage", "Glycomet"]},
            "US": {"name": "Metformin",  "brands": ["Glucophage", "Glumetza", "Fortamet"]},
            "GB": {"name": "Metformin",  "brands": ["Glucophage"]},
            "DE": {"name": "Metformin",  "brands": ["Glucophage", "Metformin Stada"]},
            "AE": {"name": "Metformin",  "brands": ["Glucophage"]},
        },
    },
    "glibenclamide": {
        "aliases": ["glibenclamide", "glyburide", "daonil", "euglucon"],
        "countries": {
            "IN": {"name": "Glibenclamide", "brands": ["Daonil", "Glucovance"]},
            "US": {"name": "Glyburide",     "brands": ["DiaBeta", "Micronase"],
                   "note": "USA uses USAN name 'Glyburide'; same molecule as Glibenclamide."},
            "GB": {"name": "Glibenclamide", "brands": ["Daonil", "Euglucon"]},
            "DE": {"name": "Glibenclamid",  "brands": ["Euglucon"]},
            "CA": {"name": "Glyburide",     "brands": ["DiaBeta"]},
            "AE": {"name": "Glibenclamide", "brands": ["Daonil"]},
        },
    },
    "glimepiride": {
        "aliases": ["glimepiride", "amaryl", "glimpid"],
        "countries": {
            "IN": {"name": "Glimepiride", "brands": ["Glimpid", "Amaryl"]},
            "US": {"name": "Glimepiride", "brands": ["Amaryl"]},
            "GB": {"name": "Glimepiride", "brands": ["Amaryl"]},
            "DE": {"name": "Glimepirid",  "brands": ["Amaryl", "Glimepirid Stada"]},
            "AE": {"name": "Glimepiride", "brands": ["Amaryl"]},
        },
    },
    "insulin": {
        "aliases": ["insulin", "insulatard", "actrapid", "huminsulin", "lantus", "glargine"],
        "countries": {
            "IN": {"name": "Insulin",  "brands": ["Huminsulin", "Actrapid", "Insulatard", "Lantus"]},
            "US": {"name": "Insulin",  "brands": ["Humulin", "Novolin", "Lantus", "Basaglar"]},
            "GB": {"name": "Insulin",  "brands": ["Humulin", "Insulatard", "Lantus"]},
            "DE": {"name": "Insulin",  "brands": ["Lantus", "Huminsulin"]},
            "AE": {"name": "Insulin",  "brands": ["Lantus", "Humulin"]},
        },
    },

    # ── Respiratory ───────────────────────────────────────────────────────────
    "salbutamol": {
        "aliases": ["salbutamol", "albuterol", "ventolin", "asthalin"],
        "countries": {
            "IN": {"name": "Salbutamol", "brands": ["Asthalin", "Ventolin", "Salbetol"]},
            "US": {"name": "Albuterol",  "brands": ["ProAir HFA", "Ventolin HFA", "Proventil"],
                   "note": "USA uses USAN name 'Albuterol'; same molecule as Salbutamol."},
            "GB": {"name": "Salbutamol", "brands": ["Ventolin", "Salamol"]},
            "AU": {"name": "Salbutamol", "brands": ["Ventolin"]},
            "DE": {"name": "Salbutamol", "brands": ["Sultanol", "Bronchospray"]},
            "CA": {"name": "Salbutamol", "brands": ["Ventolin"]},
            "AE": {"name": "Salbutamol", "brands": ["Ventolin", "Asthalin"]},
        },
    },
    "budesonide": {
        "aliases": ["budesonide", "pulmicort", "budecort", "budamate"],
        "countries": {
            "IN": {"name": "Budesonide", "brands": ["Budecort", "Pulmicort"]},
            "US": {"name": "Budesonide", "brands": ["Pulmicort", "Rhinocort"]},
            "GB": {"name": "Budesonide", "brands": ["Pulmicort", "Rhinocort"]},
            "DE": {"name": "Budesonid",  "brands": ["Pulmicort", "Budesonid Stada"]},
            "AE": {"name": "Budesonide", "brands": ["Pulmicort"]},
        },
    },
    "montelukast": {
        "aliases": ["montelukast", "singulair", "montair", "montec"],
        "countries": {
            "IN": {"name": "Montelukast", "brands": ["Montair", "Montec", "Singulair"]},
            "US": {"name": "Montelukast", "brands": ["Singulair"]},
            "GB": {"name": "Montelukast", "brands": ["Singulair"]},
            "DE": {"name": "Montelukast", "brands": ["Singulair"]},
            "AE": {"name": "Montelukast", "brands": ["Singulair", "Montair"]},
        },
    },

    # ── Cardiovascular ────────────────────────────────────────────────────────
    "atorvastatin": {
        "aliases": ["atorvastatin", "lipitor", "atorva", "storvas"],
        "countries": {
            "IN": {"name": "Atorvastatin", "brands": ["Atorva", "Storvas", "Lipitor"]},
            "US": {"name": "Atorvastatin", "brands": ["Lipitor"]},
            "GB": {"name": "Atorvastatin", "brands": ["Lipitor"]},
            "DE": {"name": "Atorvastatin", "brands": ["Sortis", "Atorvastatin Stada"]},
            "AE": {"name": "Atorvastatin", "brands": ["Lipitor"]},
        },
    },
    "rosuvastatin": {
        "aliases": ["rosuvastatin", "crestor", "rozucor", "rosuvas"],
        "countries": {
            "IN": {"name": "Rosuvastatin", "brands": ["Rozucor", "Rosuvas", "Crestor"]},
            "US": {"name": "Rosuvastatin", "brands": ["Crestor", "Ezallor"]},
            "GB": {"name": "Rosuvastatin", "brands": ["Crestor"]},
            "DE": {"name": "Rosuvastatin", "brands": ["Crestor"]},
            "AE": {"name": "Rosuvastatin", "brands": ["Crestor"]},
        },
    },
    "warfarin": {
        "aliases": ["warfarin", "coumadin", "warf", "acenocoumarol"],
        "countries": {
            "IN": {"name": "Warfarin",     "brands": ["Warf", "Uniwarfin"]},
            "US": {"name": "Warfarin",     "brands": ["Coumadin", "Jantoven"]},
            "GB": {"name": "Warfarin",     "brands": ["Coumadin"]},
            "DE": {"name": "Phenprocoumon","brands": ["Marcumar", "Falithrom"],
                   "note": "Germany predominantly uses Phenprocoumon instead of Warfarin; different dosing."},
            "AE": {"name": "Warfarin",     "brands": ["Coumadin"]},
        },
    },
    "aspirin": {
        "aliases": ["aspirin", "acetylsalicylic acid", "asa", "ecosprin", "disprin"],
        "countries": {
            "IN": {"name": "Aspirin",                  "brands": ["Ecosprin", "Disprin", "Colsprin"]},
            "US": {"name": "Aspirin",                  "brands": ["Bayer Aspirin", "Bufferin", "Ecotrin"]},
            "GB": {"name": "Aspirin",                  "brands": ["Disprin", "Micropirin"]},
            "DE": {"name": "Acetylsalicylsäure (ASS)", "brands": ["Aspirin", "ASS ratiopharm"]},
            "AE": {"name": "Aspirin",                  "brands": ["Aspirin Bayer", "Colfarit"]},
        },
    },
    "digoxin": {
        "aliases": ["digoxin", "lanoxin", "digicor"],
        "countries": {
            "IN": {"name": "Digoxin", "brands": ["Digicor", "Lanoxin"]},
            "US": {"name": "Digoxin", "brands": ["Lanoxin", "Digitek"]},
            "GB": {"name": "Digoxin", "brands": ["Lanoxin"]},
            "DE": {"name": "Digoxin", "brands": ["Lanicor", "Dilanacin"]},
            "AE": {"name": "Digoxin", "brands": ["Lanoxin"]},
        },
    },

    # ── Gastrointestinal ──────────────────────────────────────────────────────
    "omeprazole": {
        "aliases": ["omeprazole", "prilosec", "omez", "ocid"],
        "countries": {
            "IN": {"name": "Omeprazole",  "brands": ["Omez", "Ocid", "Prilosec"]},
            "US": {"name": "Omeprazole",  "brands": ["Prilosec", "Losec"]},
            "GB": {"name": "Omeprazole",  "brands": ["Losec", "Mepradec"]},
            "DE": {"name": "Omeprazol",   "brands": ["Antra", "Omeprazol ratiopharm"]},
            "AE": {"name": "Omeprazole",  "brands": ["Losec", "Omez"]},
        },
    },
    "pantoprazole": {
        "aliases": ["pantoprazole", "pantodac", "pan", "protonix"],
        "countries": {
            "IN": {"name": "Pantoprazole", "brands": ["Pan", "Pantodac", "Pantop"]},
            "US": {"name": "Pantoprazole", "brands": ["Protonix"]},
            "GB": {"name": "Pantoprazole", "brands": ["Protium"]},
            "DE": {"name": "Pantoprazol",  "brands": ["Pantozol", "Rifun"]},
            "AE": {"name": "Pantoprazole", "brands": ["Protonix", "Pantodac"]},
        },
    },
    "ondansetron": {
        "aliases": ["ondansetron", "zofran", "emeset", "ondem"],
        "countries": {
            "IN": {"name": "Ondansetron", "brands": ["Emeset", "Ondem", "Perinorm"]},
            "US": {"name": "Ondansetron", "brands": ["Zofran", "Zuplenz"]},
            "GB": {"name": "Ondansetron", "brands": ["Zofran"]},
            "DE": {"name": "Ondansetron", "brands": ["Zofran", "Ondansetron Stada"]},
            "AE": {"name": "Ondansetron", "brands": ["Zofran", "Emeset"]},
        },
    },
    "domperidone": {
        "aliases": ["domperidone", "motilium", "domstal", "vomistop"],
        "countries": {
            "IN": {"name": "Domperidone",  "brands": ["Domstal", "Vomistop", "Motilium"]},
            "US": {"name": "Domperidone",  "brands": [],
                   "note": "NOT FDA-approved in USA. Not legally available OTC or Rx. Alternative: Metoclopramide (Reglan)."},
            "GB": {"name": "Domperidone",  "brands": ["Motilium"],
                   "note": "Prescription-only in UK; restricted to short-term use."},
            "CA": {"name": "Domperidone",  "brands": ["Motilium", "Dom-Domperidone"]},
            "DE": {"name": "Domperidon",   "brands": ["Motilium"],
                   "note": "Prescription-only in Germany."},
            "AE": {"name": "Domperidone",  "brands": ["Motilium"]},
            "AU": {"name": "Domperidone",  "brands": ["Motilium"]},
        },
    },

    # ── CNS / psychiatry ──────────────────────────────────────────────────────
    "adrenaline": {
        "aliases": ["adrenaline", "epinephrine", "adrenalin"],
        "countries": {
            "IN": {"name": "Adrenaline",   "brands": ["Adrenaline BP"]},
            "US": {"name": "Epinephrine",  "brands": ["EpiPen", "Adrenalin"],
                   "note": "USA uses USAN name 'Epinephrine'; same molecule as Adrenaline."},
            "GB": {"name": "Adrenaline",   "brands": ["EpiPen", "Emerade"]},
            "DE": {"name": "Epinephrin",   "brands": ["Fastjekt", "Suprarenin"]},
            "AE": {"name": "Epinephrine",  "brands": ["EpiPen"]},
        },
    },
    "lignocaine": {
        "aliases": ["lignocaine", "lidocaine", "xylocaine", "lignox"],
        "countries": {
            "IN": {"name": "Lignocaine",  "brands": ["Lignox", "Xylocaine"]},
            "US": {"name": "Lidocaine",   "brands": ["Xylocaine", "Lidoderm"],
                   "note": "USA uses USAN name 'Lidocaine'; same molecule as Lignocaine."},
            "GB": {"name": "Lidocaine",   "brands": ["Xylocaine"],
                   "note": "UK switched from 'Lignocaine' to 'Lidocaine' (INN) in 2002."},
            "DE": {"name": "Lidocain",    "brands": ["Xylocain"]},
            "AE": {"name": "Lidocaine",   "brands": ["Xylocaine"]},
        },
    },
    "diazepam": {
        "aliases": ["diazepam", "valium", "calmpose", "placidox"],
        "countries": {
            "IN": {"name": "Diazepam",  "brands": ["Calmpose", "Placidox", "Valium"],
                   "note": "Schedule H drug in India."},
            "US": {"name": "Diazepam",  "brands": ["Valium", "Diastat"],
                   "note": "Schedule IV controlled substance in USA."},
            "GB": {"name": "Diazepam",  "brands": ["Valium", "Diazemuls"],
                   "note": "Class C controlled drug in UK."},
            "DE": {"name": "Diazepam",  "brands": ["Valium", "Diazepam ratiopharm"]},
            "AE": {"name": "Diazepam",  "brands": ["Valium"],
                   "note": "Controlled substance in UAE; requires special prescription."},
        },
    },
    "sertraline": {
        "aliases": ["sertraline", "zoloft", "sertima", "daxid"],
        "countries": {
            "IN": {"name": "Sertraline", "brands": ["Sertima", "Daxid", "Zosert"]},
            "US": {"name": "Sertraline", "brands": ["Zoloft"]},
            "GB": {"name": "Sertraline", "brands": ["Lustral"]},
            "DE": {"name": "Sertralin",  "brands": ["Zoloft", "Sertralin ratiopharm"]},
            "AE": {"name": "Sertraline", "brands": ["Zoloft"]},
        },
    },

    # ── Anticoagulants (newer) ────────────────────────────────────────────────
    "rivaroxaban": {
        "aliases": ["rivaroxaban", "xarelto"],
        "countries": {
            "IN": {"name": "Rivaroxaban", "brands": ["Xarelto", "Rivaro"]},
            "US": {"name": "Rivaroxaban", "brands": ["Xarelto"]},
            "GB": {"name": "Rivaroxaban", "brands": ["Xarelto"]},
            "DE": {"name": "Rivaroxaban", "brands": ["Xarelto"]},
            "AE": {"name": "Rivaroxaban", "brands": ["Xarelto"]},
        },
    },

    # ── Vitamins / supplements ────────────────────────────────────────────────
    "vitamin d": {
        "aliases": ["vitamin d", "vitamin d3", "cholecalciferol", "calcirol", "uprise"],
        "countries": {
            "IN": {"name": "Vitamin D3 (Cholecalciferol)", "brands": ["Calcirol", "Uprise-D3", "D-Rise"]},
            "US": {"name": "Vitamin D3 (Cholecalciferol)", "brands": ["NatureMade", "Nature's Bounty"]},
            "GB": {"name": "Colecalciferol",               "brands": ["Fultium-D3", "InVita D3"]},
            "DE": {"name": "Cholecalciferol (Vitamin D3)", "brands": ["Vigantol", "Dekristol"]},
            "AE": {"name": "Vitamin D3",                   "brands": ["Calcirol", "Vigantol"]},
        },
    },
    "calcium": {
        "aliases": ["calcium", "calcium carbonate", "shelcal", "caltrate"],
        "countries": {
            "IN": {"name": "Calcium Carbonate", "brands": ["Shelcal", "Calcimax", "Ostocalcium"]},
            "US": {"name": "Calcium Carbonate", "brands": ["Caltrate", "Os-Cal", "Tums"]},
            "GB": {"name": "Calcium Carbonate", "brands": ["Calcichew", "Adcal"]},
            "DE": {"name": "Calciumcarbonat",   "brands": ["Calcium Sandoz", "Calcimagon"]},
            "AE": {"name": "Calcium Carbonate", "brands": ["Caltrate", "Shelcal"]},
        },
    },
}


# ── Country metadata ──────────────────────────────────────────────────────────
COUNTRY_NAMES = {
    "IN": "India",
    "US": "USA",
    "GB": "UK",
    "AU": "Australia",
    "CA": "Canada",
    "DE": "Germany",
    "FR": "France",
    "AE": "UAE",
    "SA": "Saudi Arabia",
    "SG": "Singapore",
    "NZ": "New Zealand",
}

# Aliases for country input normalisation (handles what doctors type)
_COUNTRY_ALIASES = {
    "usa": "US", "united states": "US", "america": "US", "us": "US",
    "uk": "GB", "united kingdom": "GB", "britain": "GB", "england": "GB",
    "uae": "AE", "dubai": "AE", "abu dhabi": "AE", "emirates": "AE",
    "india": "IN", "in": "IN",
    "germany": "DE", "deutschland": "DE", "de": "DE",
    "australia": "AU", "au": "AU",
    "canada": "CA", "ca": "CA",
    "france": "FR", "fr": "FR",
    "saudi arabia": "SA", "saudi": "SA", "ksa": "SA",
    "singapore": "SG", "sg": "SG",
    "new zealand": "NZ", "nz": "NZ",
}


def _norm_country(raw: str) -> str | None:
    """Normalise a free-text country input to ISO alpha-2 code."""
    key = re.sub(r"[^a-z ]", "", raw.lower()).strip()
    return _COUNTRY_ALIASES.get(key)


def _norm_drug(name: str) -> str:
    """Lowercase + strip punctuation for fuzzy alias matching."""
    return re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()


def map_drug(drug_name: str, target_country: str) -> dict:
    """
    Map a single drug name to its equivalent in target_country.

    Args:
        drug_name:      extracted drug name from NER (any capitalisation)
        target_country: ISO alpha-2 code OR free text ("USA", "Germany", etc.)

    Returns dict with keys:
        inn            — WHO INN name
        source_name    — original name as extracted
        local_name     — official name in target country
        brand_examples — list of brand names in target country (may be [])
        note           — regulatory / clinical note, or ""
        country        — ISO code used
        country_name   — full country name
        mapped          — True if a mapping was found, False if fallback to INN
    """
    code = _norm_country(target_country) or target_country.upper()
    dn   = _norm_drug(drug_name)

    # Find matching INN entry
    matched_inn = None
    matched_entry = None
    for inn, entry in _TABLE.items():
        if dn == inn or dn in entry["aliases"] or any(dn in a or a in dn for a in entry["aliases"]):
            matched_inn   = inn
            matched_entry = entry
            break

    if matched_entry is None:
        # Drug not in table — return as-is
        return {
            "inn":           drug_name,
            "source_name":   drug_name,
            "local_name":    drug_name,
            "brand_examples": [],
            "note":          "Drug not found in MediScript mapping table; verify manually.",
            "country":       code,
            "country_name":  COUNTRY_NAMES.get(code, code),
            "mapped":        False,
        }

    countries = matched_entry.get("countries", {})
    target    = countries.get(code, {})

    # Fallback: if target country not in table, use the INN name itself
    local_name    = target.get("name",   matched_inn.title())
    brands        = target.get("brands", [])
    note          = target.get("note",   "")

    return {
        "inn":            matched_inn,
        "source_name":    drug_name,
        "local_name":     local_name,
        "brand_examples": brands,
        "note":           note,
        "country":        code,
        "country_name":   COUNTRY_NAMES.get(code, code),
        "mapped":         bool(target),
    }


def map_prescription(medicines: list[dict], target_country: str) -> list[dict]:
    """
    Apply map_drug() to every medicine in the medicines list.
    Returns a parallel list of mapping results.
    """
    return [map_drug(m.get("drug", ""), target_country) for m in medicines]
