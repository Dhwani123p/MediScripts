"""
MediScript - BiLSTM-CRF NER Model
Improvements over original:
  - Dropout added (prevents overfitting on small synthetic data)
  - Proper mini-batch training with DataLoader (not one giant batch)
  - Gradient clipping (prevents exploding gradients with LSTM)
  - Learning rate scheduler
  - Padding label uses a dedicated PAD id, not label 0
  - load_model() function included (was missing - run_pipeline.py needs it)
  - predict_from_text() included and structured output returns dict
  - Model saved with id_to_label (not just label_to_id)
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchcrf import CRF
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import classification_report


# ───────────────────────────────────────────
# 1. Data loading
# ───────────────────────────────────────────

def load_conll(path):
    """Reads a CoNLL file. Returns list of sentences and list of tag sequences."""
    sentences, labels = [], []
    words, tags = [], []

    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                if words:
                    sentences.append(words)
                    labels.append(tags)
                    words, tags = [], []
            else:
                parts = line.split()
                if len(parts) != 2:
                    # Skip malformed lines instead of crashing
                    continue
                w, t = parts
                words.append(w)
                tags.append(t)

    # Don't forget last sentence if file has no trailing newline
    if words:
        sentences.append(words)
        labels.append(tags)

    return sentences, labels


# ───────────────────────────────────────────
# 2. Vocabulary builders
# ───────────────────────────────────────────

def build_word_vocab(sentences):
    vocab = {"<PAD>": 0, "<UNK>": 1}
    for s in sentences:
        for w in s:
            # Store lowercase too so inference is case-insensitive
            key = w.lower()
            if key not in vocab:
                vocab[key] = len(vocab)
    return vocab


def build_label_vocab(tag_sequences):
    # PAD label must be index 0 — CRF mask relies on this
    label_to_id = {"<PAD>": 0}
    all_labels = sorted({t for seq in tag_sequences for t in seq})
    for lbl in all_labels:
        if lbl not in label_to_id:
            label_to_id[lbl] = len(label_to_id)
    id_to_label = {i: l for l, i in label_to_id.items()}
    return label_to_id, id_to_label


# ───────────────────────────────────────────
# 3. PyTorch Dataset
# ───────────────────────────────────────────

class NERDataset(Dataset):
    def __init__(self, sentences, tags, word_vocab, label_to_id):
        self.data = []
        for s, t in zip(sentences, tags):
            x = [word_vocab.get(w.lower(), word_vocab["<UNK>"]) for w in s]
            y = [label_to_id[tag] for tag in t]
            self.data.append((x, y))

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        return self.data[idx]


def collate_fn(batch):
    """Pads a batch of variable-length sequences."""
    xs, ys = zip(*batch)
    max_len = max(len(x) for x in xs)

    X, Y, M = [], [], []
    for x, y in zip(xs, ys):
        pad_len = max_len - len(x)
        X.append(x + [0] * pad_len)          # 0 = <PAD>
        Y.append(y + [0] * pad_len)          # 0 = <PAD> label
        M.append([1] * len(x) + [0] * pad_len)

    return (
        torch.tensor(X, dtype=torch.long),
        torch.tensor(Y, dtype=torch.long),
        torch.tensor(M, dtype=torch.bool),
    )


# ───────────────────────────────────────────
# 4. Model
# ───────────────────────────────────────────

class BiLSTM_CRF(nn.Module):
    def __init__(self, vocab_size, tagset_size, emb_dim=128, hidden_dim=256, dropout=0.3):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, emb_dim, padding_idx=0)
        self.dropout = nn.Dropout(dropout)
        self.lstm = nn.LSTM(
            emb_dim,
            hidden_dim // 2,
            num_layers=2,           # 2-layer LSTM captures more context
            batch_first=True,
            bidirectional=True,
            dropout=dropout,
        )
        self.fc = nn.Linear(hidden_dim, tagset_size)
        self.crf = CRF(tagset_size, batch_first=True)

    def forward(self, x, tags=None, mask=None, return_emissions=False):
        emb = self.dropout(self.embedding(x))
        out, _ = self.lstm(emb)
        out = self.dropout(out)
        emissions = self.fc(out)

        if tags is not None:
            # Returns negative log-likelihood (loss)
            return -self.crf(emissions, tags, mask=mask, reduction="mean")
        elif return_emissions:
            # Returns (predictions, emissions) so caller can compute confidence
            return self.crf.decode(emissions, mask=mask), emissions
        else:
            return self.crf.decode(emissions, mask=mask)


# ───────────────────────────────────────────
# 5. Training
# ───────────────────────────────────────────

def train(train_path, val_path, save_path,
          emb_dim=128, hidden_dim=256, dropout=0.3,
          epochs=30, batch_size=32, lr=0.001):

    print("Loading data...")
    train_sents, train_tags = load_conll(train_path)
    val_sents,   val_tags   = load_conll(val_path)
    print(f"  Train: {len(train_sents)} sentences | Val: {len(val_sents)} sentences")

    word_vocab              = build_word_vocab(train_sents + val_sents)
    label_to_id, id_to_label = build_label_vocab(train_tags + val_tags)

    train_dataset = NERDataset(train_sents, train_tags, word_vocab, label_to_id)
    val_dataset   = NERDataset(val_sents,   val_tags,   word_vocab, label_to_id)

    train_loader = DataLoader(train_dataset, batch_size=batch_size,
                              shuffle=True, collate_fn=collate_fn)
    val_loader   = DataLoader(val_dataset,   batch_size=batch_size,
                              shuffle=False, collate_fn=collate_fn)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Device: {device}")

    model = BiLSTM_CRF(
        vocab_size=len(word_vocab),
        tagset_size=len(label_to_id),
        emb_dim=emb_dim,
        hidden_dim=hidden_dim,
        dropout=dropout,
    ).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    # Reduce LR by half if val loss doesn't improve for 5 epochs
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, patience=5, factor=0.5
    )

    best_val_loss = float("inf")

    for epoch in range(1, epochs + 1):
        # ── Train ──
        model.train()
        total_train_loss = 0.0
        for X, Y, M in train_loader:
            X, Y, M = X.to(device), Y.to(device), M.to(device)
            optimizer.zero_grad()
            loss = model(X, tags=Y, mask=M)
            loss.backward()
            # Gradient clipping prevents LSTM exploding gradients
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
            optimizer.step()
            total_train_loss += loss.item()

        avg_train_loss = total_train_loss / len(train_loader)

        # ── Validate ──
        model.eval()
        total_val_loss = 0.0
        with torch.no_grad():
            for X, Y, M in val_loader:
                X, Y, M = X.to(device), Y.to(device), M.to(device)
                loss = model(X, tags=Y, mask=M)
                total_val_loss += loss.item()

        avg_val_loss = total_val_loss / len(val_loader)
        scheduler.step(avg_val_loss)

        print(f"Epoch {epoch:02d}/{epochs} | "
              f"Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f}")

        # Save best model
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            torch.save({
                "model_state":  model.state_dict(),
                "vocab":        word_vocab,
                "label_to_id":  label_to_id,
                "id_to_label":  id_to_label,
                "model_config": {
                    "vocab_size":  len(word_vocab),
                    "tagset_size": len(label_to_id),
                    "emb_dim":     emb_dim,
                    "hidden_dim":  hidden_dim,
                    "dropout":     dropout,
                }
            }, save_path)
            print(f"  ✓ Best model saved (val_loss={best_val_loss:.4f})")

    print(f"\nTraining complete. Best val loss: {best_val_loss:.4f}")
    return model, word_vocab, id_to_label


# ───────────────────────────────────────────
# 6. Evaluation
# ───────────────────────────────────────────

def evaluate(test_path, model_path):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, word_vocab, id_to_label = load_model(model_path, device)
    label_to_id = {v: k for k, v in id_to_label.items()}

    test_sents, test_tags = load_conll(test_path)
    dataset = NERDataset(test_sents, test_tags, word_vocab, label_to_id)
    loader  = DataLoader(dataset, batch_size=32, collate_fn=collate_fn)

    model.eval()
    all_true, all_pred = [], []

    with torch.no_grad():
        for X, Y, M in loader:
            X, M = X.to(device), M.to(device)
            predictions = model(X, mask=M)

            for i, pred_seq in enumerate(predictions):
                seq_len = M[i].sum().item()
                true_seq = Y[i][:seq_len].tolist()
                all_true.extend(true_seq)
                all_pred.extend(pred_seq)

    # Convert ids back to string labels (skip PAD=0)
    true_labels = [id_to_label[i] for i in all_true]
    pred_labels = [id_to_label[i] for i in all_pred]

    # Filter out PAD labels from report
    filtered = [(t, p) for t, p in zip(true_labels, pred_labels) if t != "<PAD>"]
    true_labels, pred_labels = zip(*filtered) if filtered else ([], [])

    print(classification_report(true_labels, pred_labels, digits=4))


# ───────────────────────────────────────────
# 7. Inference helpers (used by run_pipeline.py)
# ───────────────────────────────────────────

def load_model(model_path, device="cpu"):
    """
    Loads a saved model checkpoint.
    Returns (model, word_vocab, id_to_label).
    This function was MISSING in original — run_pipeline.py imports it.
    """
    checkpoint = torch.load(model_path, map_location=device)

    cfg = checkpoint["model_config"]
    model = BiLSTM_CRF(
        vocab_size=cfg["vocab_size"],
        tagset_size=cfg["tagset_size"],
        emb_dim=cfg["emb_dim"],
        hidden_dim=cfg["hidden_dim"],
        dropout=cfg.get("dropout", 0.3),
    ).to(device)

    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    return model, checkpoint["vocab"], checkpoint["id_to_label"]


def predict_from_text(text, model, word_vocab, id_to_label, device="cpu"):
    """
    Runs NER on a raw text string.
    Returns a structured prescription dict:
    {
      "drugs":       [...],
      "doses":       [...],
      "frequencies": [...],
      "durations":   [...],
      "routes":      [...],
      "raw_tokens":  [(token, label), ...],
      "confidence_scores": {
        "drugs":       [0.94, ...],
        "doses":       [0.87, ...],
        "frequencies": [0.76, ...],
        "durations":   [0.91, ...],
        "routes":      [0.65, ...],
      }
    }
    Confidence per entity = mean softmax probability of the predicted label
    across the token(s) that make up that entity (B- + I- tokens averaged).
    """
    tokens = text.strip().split()
    if not tokens:
        return {}

    encoded = [word_vocab.get(tok.lower(), word_vocab["<UNK>"]) for tok in tokens]
    X    = torch.tensor([encoded], dtype=torch.long).to(device)
    mask = torch.tensor([[1] * len(encoded)], dtype=torch.bool).to(device)

    model.eval()
    with torch.no_grad():
        pred_ids_batch, emissions = model(X, mask=mask, return_emissions=True)
        pred_ids = pred_ids_batch[0]  # list[int], length = len(tokens)

    # Per-token confidence: softmax over emission logits, pick score of predicted label
    # emissions shape: (1, seq_len, tagset_size)
    probs      = F.softmax(emissions[0], dim=-1)          # (seq_len, tagset_size)
    token_conf = [float(probs[t, pred_ids[t]]) for t in range(len(pred_ids))]

    # ── Group consecutive tokens by entity type ──
    result = {
        "drugs":       [],
        "doses":       [],
        "frequencies": [],
        "durations":   [],
        "routes":      [],
        "raw_tokens":  [],
        "confidence_scores": {
            "drugs":       [],
            "doses":       [],
            "frequencies": [],
            "durations":   [],
            "routes":      [],
        },
    }

    TAG_TO_KEY = {
        "DRUG":  "drugs",
        "DOSE":  "doses",
        "FREQ":  "frequencies",
        "DUR":   "durations",
        "ROUTE": "routes",
    }

    current_entity = []
    current_type   = None
    current_confs  = []

    def _flush():
        if current_entity and current_type:
            key = TAG_TO_KEY.get(current_type)
            if key:
                result[key].append(" ".join(current_entity))
                avg_conf = sum(current_confs) / len(current_confs)
                result["confidence_scores"][key].append(round(avg_conf, 4))

    for idx, (tok, tag_id) in enumerate(zip(tokens, pred_ids)):
        label = id_to_label.get(tag_id, "O")
        result["raw_tokens"].append((tok, label))

        if label.startswith("B-"):
            _flush()
            current_entity = [tok]
            current_type   = label[2:]
            current_confs  = [token_conf[idx]]

        elif label.startswith("I-") and current_type == label[2:]:
            current_entity.append(tok)
            current_confs.append(token_conf[idx])

        else:
            # O label or unexpected transition — flush current entity
            _flush()
            current_entity = []
            current_type   = None
            current_confs  = []

    # Flush last entity
    _flush()

    return result


# ───────────────────────────────────────────
# 8. Quick test
# ───────────────────────────────────────────

if __name__ == "__main__":
    # Quick sanity check on predict_from_text with a dummy loaded model
    # (requires mediscript_ner.pt to exist)
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "mediscript_ner.pt")
    if not os.path.exists(MODEL_PATH):
        print("No saved model found. Run train() first.")
    else:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model, vocab, id_to_label = load_model(MODEL_PATH, device)
        test_text = "Paracetamol 650 mg twice a day for 5 days after food"
        output = predict_from_text(test_text, model, vocab, id_to_label, device)
        import json
        print(json.dumps(output, indent=2))