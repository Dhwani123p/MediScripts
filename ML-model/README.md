---
title: MediScript
emoji: 💊
colorFrom: blue
colorTo: teal
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# MediScript — AI Prescription Extractor

Extracts structured prescription entities from spoken or typed medical prescriptions.

**Pipeline:** OpenAI Whisper (ASR) → BiLSTM-CRF (NER)

**Entities extracted:**
- Drug names
- Doses
- Frequencies (OD, BD, TDS, twice daily, …)
- Durations
- Routes (after food, on empty stomach, …)

**Supported languages:** English · Hindi (Roman script)
