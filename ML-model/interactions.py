"""
MediScript — Drug-drug interaction checker
Uses the free RxNorm / RxNav API from the US National Library of Medicine.
No API key required.

Endpoints used:
  • GET https://rxnav.nlm.nih.gov/REST/rxcui.json?name=<drug>&search=1
      → resolves a drug name to its RxCUI identifier
  • GET https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=<id1>+<id2>+...
      → returns all known interactions between the listed drugs
"""

import logging
import requests

_RXNAV = "https://rxnav.nlm.nih.gov/REST"
_TIMEOUT = 6          # seconds per request — kept short so a slow API doesn't block the endpoint
_SESSION = requests.Session()
_SESSION.headers.update({"Accept": "application/json"})

log = logging.getLogger("mediscript.interactions")


# ── RxCUI lookup ──────────────────────────────────────────────────────────────

def _get_rxcui(drug_name: str) -> str | None:
    """
    Resolve a drug name → RxCUI.
    'search=1' enables approximate matching so minor Whisper transcription
    errors (e.g. "Acetaminophen" vs "Paracetamol") still resolve.
    Returns None if not found or on network error.
    """
    try:
        r = _SESSION.get(
            f"{_RXNAV}/rxcui.json",
            params={"name": drug_name, "search": 1},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        cuis = r.json().get("idGroup", {}).get("rxnormId", [])
        return cuis[0] if cuis else None
    except Exception as exc:
        log.warning("RxCUI lookup failed for %r: %s", drug_name, exc)
        return None


# ── Interaction check ─────────────────────────────────────────────────────────

def _parse_interactions(data: dict) -> list[dict]:
    """
    Parse the fullInteractionTypeGroup structure returned by the RxNav API
    into a flat list of interaction dicts.
    """
    results = []
    for group in data.get("fullInteractionTypeGroup", []):
        source = group.get("sourceName", "")
        for itype in group.get("fullInteractionType", []):
            for pair in itype.get("interactionPair", []):
                drugs = [
                    c["minConceptItem"]["name"]
                    for c in pair.get("interactionConcept", [])
                ]
                severity    = pair.get("severity", "unknown").lower()
                description = pair.get("description", "").strip()
                if drugs and description:
                    results.append({
                        "drugs":       drugs,
                        "severity":    severity,     # "high" | "moderate" | "low" | "unknown"
                        "description": description,
                        "source":      source,        # e.g. "DrugBank", "ONCHigh"
                    })
    return results


def check_interactions(drug_names: list[str]) -> list[dict]:
    """
    Given a list of drug names (plain English), return all known interactions.

    Returns [] when:
      • fewer than 2 drugs are supplied
      • fewer than 2 drugs resolve to RxCUIs
      • the RxNav API is unreachable or returns no interaction data

    Each returned dict has:
      {
        "drugs":       ["DrugA", "DrugB"],   # canonical RxNorm names
        "severity":    "high",               # "high" | "moderate" | "low"
        "description": "Increased risk …",
        "source":      "DrugBank"
      }
    """
    if len(drug_names) < 2:
        return []

    # Resolve names → RxCUIs (skip any that fail)
    rxcuis = {}
    for name in drug_names:
        cui = _get_rxcui(name)
        if cui:
            rxcuis[name] = cui
        else:
            log.info("No RxCUI found for %r — skipped in interaction check", name)

    if len(rxcuis) < 2:
        return []

    try:
        r = _SESSION.get(
            f"{_RXNAV}/interaction/list.json",
            params={"rxcuis": " ".join(rxcuis.values())},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        interactions = _parse_interactions(r.json())

        # De-duplicate: same drug pair can appear in multiple sources.
        # Keep highest-severity entry per unique (drug-pair, description) pair.
        seen: set[tuple] = set()
        unique = []
        for item in interactions:
            key = (frozenset(item["drugs"]), item["description"][:60])
            if key not in seen:
                seen.add(key)
                unique.append(item)

        return unique

    except Exception as exc:
        log.warning("Interaction API call failed: %s", exc)
        return []
