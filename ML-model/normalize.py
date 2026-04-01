"""
MediScript — Post-processing normalizer
Converts raw NER output (English phrases + Hindi/Hinglish terms) into
standard medical abbreviations used on printed prescriptions.
No model retraining needed — pure rule-based substitution.
"""

import re

# ── Drug name prefixes ────────────────────────────────────────────────────────
# Strip formulation prefixes that Whisper or typed input may prepend.
# Examples: "Tab. Paracetamol" → "Paracetamol", "Syp Amoxicillin" → "Amoxicillin"
_DRUG_PREFIX = re.compile(
    r'^\s*(?:tab\.?|tablet|cap\.?|capsule|syp\.?|syrup|inj\.?|injection'
    r'|drops?|ointment|cream|gel|patch|inhaler|susp\.?|suspension'
    r'|liq\.?|liquid)\s+',
    re.IGNORECASE,
)
# Strip trailing formulation suffixes too: "Paracetamol tab" → "Paracetamol"
_DRUG_SUFFIX = re.compile(
    r'\s+(?:tab(?:let)?s?|cap(?:sule)?s?|syrup|injection|drops?|ointment'
    r'|cream|gel|patch|inhaler|susp(?:ension)?)\s*$',
    re.IGNORECASE,
)

# ── Dosing schedule format (Indian Rx) ────────────────────────────────────────
# "1-1-1" → TDS, "1-0-1" → BD, "0-0-1" → HS (at night), etc.
# Must be applied BEFORE the generic FREQ_RULES.
_SCHEDULE_MAP = [
    (r'\b1\s*[-–]\s*1\s*[-–]\s*1\b',  'TDS'),
    (r'\b1\s*[-–]\s*1\s*[-–]\s*0\b',  'BD (morning and afternoon)'),
    (r'\b0\s*[-–]\s*1\s*[-–]\s*1\b',  'BD (afternoon and night)'),
    (r'\b1\s*[-–]\s*0\s*[-–]\s*1\b',  'BD'),
    (r'\b1\s*[-–]\s*0\s*[-–]\s*0\b',  'OD (morning)'),
    (r'\b0\s*[-–]\s*0\s*[-–]\s*1\b',  'HS'),
    (r'\b0\s*[-–]\s*1\s*[-–]\s*0\b',  'OD (afternoon)'),
    (r'\b1\s*[-–]\s*1\s*[-–]\s*1\s*[-–]\s*1\b', 'QID'),
]

# ── Frequency ─────────────────────────────────────────────────────────────────
# Pattern order matters: longer / more specific patterns first.
FREQ_RULES = [
    # ── Indian dosing schedule (1-0-1 etc.) ──
    *_SCHEDULE_MAP,

    # ── Latin / classical abbreviations ──
    (r'\bstat\b',                                'stat (immediately)'),
    (r'\bnocte\b',                               'HS'),
    (r'\bmane\b',                                'OD (morning)'),
    (r'\bbd\b',                                  'BD'),
    (r'\btds\b',                                 'TDS'),
    (r'\bqid\b',                                 'QID'),
    (r'\bod\b',                                  'OD'),
    (r'\bsos\b',                                 'SOS'),
    (r'\bprn\b',                                 'PRN'),
    (r'\bhs\b',                                  'HS'),

    # ── Hindi / Hinglish ──
    (r'\bchar\s+baar\b',                         'QID'),          # chaar → char (Whisper variant)
    (r'\bchaar\s+baar\b',                        'QID'),
    (r'\bteen\s+baar\s+roz\b',                   'TDS'),
    (r'\bteen\s+baar\b',                         'TDS'),
    (r'\bdin\s+mein\s+teen\s+baar\b',            'TDS'),
    (r'\bdo\s+baar\s+roz\b',                     'BD'),
    (r'\bdo\s+baar\b',                           'BD'),
    (r'\bdin\s+mein\s+do\s+baar\b',              'BD'),
    (r'\bek\s+baar\s+roz\b',                     'OD'),
    (r'\bek\s+baar\b',                           'OD'),
    (r'\bbaar\s+baar\b',                         'frequently'),
    (r'\bsubah\s+dopahar\s+(?:sham|raat)\b',     'TDS'),
    (r'\bsubah\s+aur\s+dopahar\s+aur\s+raat\b',  'TDS'),
    (r'\bsubah\s+aur\s+raat\b',                  'BD'),
    (r'\bsubah\s+sham\b',                        'BD'),
    (r'\bsubah\s+ko\b',                          'OD (morning)'),
    (r'\bsubah\b',                               'OD (morning)'),
    (r'\bdopahar\s+ko\b',                        'OD (afternoon)'),
    (r'\bdopahar\b',                             'OD (afternoon)'),
    (r'\braat\s+ko\b',                           'HS (at night)'),
    (r'\braat\b',                                'HS (at night)'),
    (r'\bsham\s+ko\b',                           'OD (evening)'),
    (r'\bsham\b',                                'OD (evening)'),
    (r'\brozana\b',                              'OD'),
    (r'\bhar\s+roz\b',                           'OD'),
    (r'\broz\b',                                 'OD'),
    (r'\bhar\s+(\d+)\s+ghante?\b',               lambda m: f'q{m.group(1)}h'),

    # ── English — four times ──
    (r'\b(?:four|4)\s+times?\s+(?:a\s+)?day\b',  'QID'),
    (r'\bq\.?i\.?d\.?\b',                        'QID'),

    # ── English — three times ──
    (r'\bthree\s+times?\s+(?:a\s+)?day\b',       'TDS'),
    (r'\bthrice\s+(?:a\s+)?day\b',               'TDS'),
    (r'\bthrice\s+daily\b',                      'TDS'),
    (r'\bt\.?d\.?s\.?\b',                        'TDS'),
    (r'\b3\s+times?\s+(?:a\s+)?day\b',           'TDS'),

    # ── English — twice ──
    (r'\btwice\s+(?:a\s+)?day\b',                'BD'),
    (r'\btwice\s+daily\b',                       'BD'),
    (r'\b(?:two|2)\s+times?\s+(?:a\s+)?day\b',   'BD'),
    (r'\bb\.?d\.?\b',                            'BD'),

    # ── English — once ──
    (r'\bonce\s+(?:a\s+)?day\b',                 'OD'),
    (r'\bonce\s+daily\b',                        'OD'),
    (r'\b(?:one|1)\s+time?\s+(?:a\s+)?day\b',    'OD'),
    (r'\bo\.?d\.?\b',                            'OD'),
    (r'\bdaily\b',                               'OD'),

    # ── Every-N-hours ──
    (r'\bevery\s+(\d+)\s+hours?\b',              lambda m: f'q{m.group(1)}h'),
    (r'\bq\.?(\d+)h\.?\b',                       lambda m: f'q{m.group(1)}h'),

    # ── Alternate days ──
    (r'\bevery\s+other\s+day\b',                 'QOD'),
    (r'\balternate\s+days?\b',                   'QOD'),
    (r'\bq\.?o\.?d\.?\b',                        'QOD'),
    (r'\bek\s+din\s+chhod\s+ke\b',              'QOD'),   # Hindi alternate days

    # ── Weekly ──
    (r'\bonce\s+(?:a\s+)?week\b',                'OW'),
    (r'\bweekly\b',                              'OW'),
    (r'\bhafta(?:war)?\b',                       'OW'),   # Hindi weekly

    # ── As needed ──
    (r'\bif\s+(?:and\s+)?(?:when\s+)?needed\b',  'SOS'),
    (r'\bas\s+(?:and\s+)?when\s+needed\b',        'SOS'),
    (r'\bwhen\s+(?:required|needed)\b',           'SOS'),
    (r'\bs\.?o\.?s\.?\b',                        'SOS'),
    (r'\bp\.?r\.?n\.?\b',                        'PRN'),
    (r'\bjaroorat\s+hone\s+par\b',               'SOS'),  # Hindi as needed

    # ── Night / morning standalone (English) ──
    (r'\bat\s+bedtime\b',                        'HS'),
    (r'\bh\.?s\.?\b',                            'HS'),
    (r'\bevery\s+morning\b',                     'OD (morning)'),
    (r'\bevery\s+night\b',                       'HS'),
]

# ── Duration ──────────────────────────────────────────────────────────────────
DUR_RULES = [
    # Medical shorthand (e.g. 1/52 = 1 week, 1/12 = 1 month)
    (r'\b(\d+)/52\b',   lambda m: f'{m.group(1)} week{"s" if int(m.group(1))>1 else ""}'),
    (r'\b(\d+)/12\b',   lambda m: f'{m.group(1)} month{"s" if int(m.group(1))>1 else ""}'),
    (r'\b(\d+)/7\b',    lambda m: f'{m.group(1)} day{"s" if int(m.group(1))>1 else ""}'),

    # Hindi number words
    (r'\bek\b',      '1'),
    (r'\bdo\b',      '2'),
    (r'\bteen\b',    '3'),
    (r'\bchar\b',    '4'),
    (r'\bchaar\b',   '4'),
    (r'\bpaanch\b',  '5'),
    (r'\bchhe\b',    '6'),
    (r'\bcheh\b',    '6'),    # Whisper variant
    (r'\bsaat\b',    '7'),
    (r'\baath\b',    '8'),
    (r'\bnau\b',     '9'),
    (r'\bdas\b',     '10'),
    (r'\bbarah\b',   '12'),
    (r'\bpandrah\b', '15'),
    (r'\bees\b',     '20'),
    (r'\btees\b',    '30'),

    # Hindi time units + Whisper variants
    (r'\bdin\b',            'days'),
    (r'\bdyn\b',            'days'),
    (r'\bdyne?\b',          'days'),
    (r'\bdeen\b',           'days'),
    (r'\bhafta\b',          'weeks'),
    (r'\bhafte\b',          'weeks'),
    (r'\bhafte\s+bhar\b',   'weeks'),
    (r'\bhaft[ae]?\b',      'weeks'),
    (r'\bmahine?\b',        'months'),
    (r'\bmaheene?\b',       'months'),
    (r'\bsaalon?\b',        'years'),
    (r'\bsaal\b',           'years'),

    # Special durations
    (r'\blong\s+term\b',      'long term'),
    (r'\bindefinitely\b',     'indefinitely'),
    (r'\btill\s+(?:further\s+)?(?:notice|review|reviewed)\b', 'till reviewed'),
    (r'\bongoing\b',          'ongoing'),
    (r'\bcontinuous(?:ly)?\b','ongoing'),

    # English normalisation
    (r'\bday\b',     'days'),
    (r'\bweek\b',    'weeks'),
    (r'\bmonth\b',   'months'),
    (r'\byear\b',    'years'),
]

# ── Route / instructions ──────────────────────────────────────────────────────
ROUTE_RULES = [
    # ── Hindi / Hinglish ──
    (r'\bnaak\s+(?:mein|ke\s+andar|me)\b',                 'nasal'),
    (r'\baankh(?:on)?\s+(?:mein|me)\b',                    'eye drops'),
    (r'\bkaan\s+(?:mein|me)\b',                            'ear drops'),
    (r'\bkhali\s+pet(?:\s+(?:pe|par|mein|me|se))?\b',      'empty stomach'),
    (r'\bbina\s+khaaye?\b',                                'empty stomach'),
    (r'\bbina\s+khaane\s+ke\b',                            'before food'),
    (r'\bkhane\s+ke\s+baad\b',                             'after food'),
    (r'\bkhane\s+(?:ke\s+)?baad\b',                        'after food'),
    (r'\bkhane\s+se\s+pehle\b',                            'before food'),
    (r'\bkhaane\s+(?:se\s+)?pehle\b',                      'before food'),
    (r'\bkhaane\s+ke\s+saath\b',                           'with food'),
    (r'\bkhane\s+ke\s+saath\b',                            'with food'),
    (r'\bpaani\s+ke\s+saath\b',                            'with water'),
    (r'\bpani\s+ke\s+saath\b',                             'with water'),   # typo variant
    (r'\bdoodh\s+ke\s+saath\b',                            'with milk'),
    (r'\bgaram\s+paani\s+(?:ke\s+saath)?\b',               'with warm water'),
    (r'\bnigli?\s+(?:lena|lo)\b',                          'oral'),         # "nigal lena" = swallow
    (r'\bchabakar\b',                                      'chew'),

    # ── English phrases → concise terms ──
    (r'\bafter\s+(?:food|meals?|eating)\b',                'after food'),
    (r'\bwith\s+(?:food|meals?)\b',                        'with food'),
    (r'\bbefore\s+(?:food|meals?|eating|breakfast)\b',     'before food'),
    (r'\bon\s+(?:an?\s+)?empty\s+stomach\b',               'empty stomach'),
    (r'\bwith\s+(?:a\s+glass\s+of\s+)?(?:warm\s+)?water\b', 'with water'),
    (r'\bunder\s+(?:the\s+)?tongue\b',                     'sublingual'),
    (r'\bsublingually?\b',                                 'sublingual'),
    (r'\bapply\s+(?:to|on)\s+(?:affected\s+)?(?:area|skin)\b', 'topical'),
    (r'\btopically?\b',                                    'topical'),
    (r'\borally?\b',                                       'oral'),
    (r'\bby\s+mouth\b',                                    'oral'),
    (r'\bchew\s+(?:before\s+)?swallowing\b',               'chew'),
    (r'\bdo\s+not\s+crush\b',                              'swallow whole'),
    (r'\bswallow\s+whole\b',                               'swallow whole'),

    # ── Route of administration ──
    (r'\bintravenously?\b',                                'IV'),
    (r'\bintramuscularly?\b',                              'IM'),
    (r'\bsubcutaneously?\b',                               'SC'),
    (r'\bnasally?\b',                                      'nasal'),
    (r'\binto\s+(?:the\s+)?(?:right|left)?\s*(?:eye|eyes)\b', 'eye drops'),
    (r'\binto\s+(?:the\s+)?(?:right|left)?\s*(?:ear|ears)\b', 'ear drops'),
]


# ── Engine ────────────────────────────────────────────────────────────────────

# Words that can leak into any field from NER span boundaries
_NOISE_WORDS = r'(?:for|a|an|the|and|or|on|with|aur|ke|ka|ki|ko|se|pe|par|mein|me)'

_TRAILING_NOISE = re.compile(
    r'[\s,]+\b' + _NOISE_WORDS + r'\b[\s,]*$', re.IGNORECASE
)
_LEADING_NOISE = re.compile(
    r'^\s*\b' + _NOISE_WORDS + r'\b[\s,]+', re.IGNORECASE
)
# Standalone noise that somehow becomes the entire value
_ONLY_NOISE = re.compile(
    r'^\s*\b' + _NOISE_WORDS + r'\b\s*$', re.IGNORECASE
)

# "×" or "x" used for duration: "BD × 5 days" — strip the multiplier symbol
_TIMES_SYMBOL = re.compile(r'[×x]\s*', re.IGNORECASE)


def _apply_rules(text: str, rules: list) -> str:
    if not text:
        return text
    result = text.strip()

    # Strip "×"/"x" multiplier symbols (e.g. "BD × 5 days" frequency part)
    result = _TIMES_SYMBOL.sub('', result).strip()

    # Remove leading and trailing connector/noise words
    result = _LEADING_NOISE.sub('', result).strip()
    result = _TRAILING_NOISE.sub('', result).strip()

    # If the entire value is just noise, return empty
    if _ONLY_NOISE.match(result):
        return ''

    for pattern, replacement in rules:
        if callable(replacement):
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
        else:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

    # Strip any trailing noise introduced after substitution
    result = _TRAILING_NOISE.sub('', result).strip()
    return result


def _normalize_drug(name: str) -> str:
    """Strip common formulation prefixes/suffixes from drug names."""
    name = name.strip()
    name = _DRUG_PREFIX.sub('', name).strip()
    name = _DRUG_SUFFIX.sub('', name).strip()
    return name


def normalize_entity(entity: dict) -> dict:
    """
    Normalize a single medicine dict returned by _group_entities().
    Converts Hindi/Hinglish terms and verbose English phrases into
    standard medical abbreviations.
    """
    return {
        "drug":      _normalize_drug(entity.get("drug", "")),
        "dose":      entity.get("dose", "").strip(),
        "frequency": _apply_rules(entity.get("frequency", ""), FREQ_RULES),
        "duration":  _apply_rules(entity.get("duration",  ""), DUR_RULES),
        "route":     _apply_rules(entity.get("route",     ""), ROUTE_RULES),
    }
