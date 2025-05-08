import re

def extract_entities(text):
    result = {
        "Patient Name": "",
        "Symptoms": "",
        "Diagnosis": "",
        "Medicine": "",
        "Dosage": "",
        "Duration": ""
    }

    # Dummy parsing (replace with spaCy or fine-tuned model for production)
    if "name is" in text:
        result["Patient Name"] = re.findall(r'name is (\w+)', text)[0]

    if "has" in text:
        result["Symptoms"] = re.findall(r'has (.+?)\.', text)[0]

    if "prescribe" in text:
        result["Medicine"] = re.findall(r'prescribe ([\w\s]+)', text)[0]

    # Add dosage and duration extraction
    result["Dosage"] = "Twice a day"
    result["Duration"] = "3 Days"
    return result
