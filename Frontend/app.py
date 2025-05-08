import streamlit as st
from app.speech_to_text import speech_to_text
from app.nlp_module import extract_entities
from app.pdf_generator import generate_prescription

st.title("Voice to Prescription Generator")

if st.button("Start Recording"):
    raw_text = speech_to_text()
    st.write("Recognized Text:", raw_text)

    data = extract_entities(raw_text)
    st.write("Extracted Data:", data)

    generate_prescription(data, "prescription")
    st.success("Prescription PDF generated!")
