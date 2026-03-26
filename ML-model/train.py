import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ner.data.generating_data import split_and_write
from ner.model.NER_2 import train, evaluate

DATA_DIR  = os.path.join(os.path.dirname(__file__), "ner", "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "ner", "model")

if __name__ == "__main__":
    print("Step 1: Generating data...")
    os.chdir(DATA_DIR)
    split_and_write()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print("\nStep 2: Training model...")
    train(
        train_path=os.path.join(DATA_DIR, "train.conll"),
        val_path=os.path.join(DATA_DIR, "val.conll"),
        save_path=os.path.join(MODEL_DIR, "mediscript_ner.pt"),
    )

    print("\nStep 3: Evaluating...")
    evaluate(
        test_path=os.path.join(DATA_DIR, "test.conll"),
        model_path=os.path.join(MODEL_DIR, "mediscript_ner.pt"),
    )