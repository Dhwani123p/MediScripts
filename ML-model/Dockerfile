FROM python:3.10-slim

# System deps: ffmpeg (Whisper audio decoding) + git (whisper model fetch)
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        git \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user (HF Spaces requirement)
RUN useradd -m -u 1000 appuser
WORKDIR /app

# Install Python dependencies first (layer cache friendly)
COPY --chown=appuser:appuser requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
