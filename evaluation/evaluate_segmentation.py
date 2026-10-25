import json
from pathlib import Path


def evaluate_boundaries(
    annotated: list[float],
    predicted: list[float],
    tolerance_seconds: float = 45.0,
) -> dict:
    """Calculates Precision, Recall, and F1 score for boundary detection
    within a specified temporal tolerance window (e.g. ±45s).
    """
    # Exclude trivial start (0.0) and end boundary
    ref_b = [b for b in annotated[1:-1]]
    pred_b = [b for b in predicted[1:-1]]

    matched_refs = set()
    true_positives = 0

    for p in pred_b:
        for idx, r in enumerate(ref_b):
            if abs(p - r) <= tolerance_seconds and idx not in matched_refs:
                matched_refs.add(idx)
                true_positives += 1
                break

    precision = true_positives / len(pred_b) if pred_b else 0.0
    recall = true_positives / len(ref_b) if ref_b else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {
        "true_positives": true_positives,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def run_segmentation_evaluation():
    data_path = Path(__file__).parent / "data" / "ground_truth_segmentation.json"
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    annotated = data["annotated_boundaries_seconds"]
    baseline = data["baseline_boundaries_seconds"]
    transformer = data["transformer_boundaries_seconds"]

    baseline_metrics = evaluate_boundaries(annotated, baseline, tolerance_seconds=45.0)
    transformer_metrics = evaluate_boundaries(annotated, transformer, tolerance_seconds=45.0)

    print("\n=======================================================")
    print("      LECTURELENS TOPIC SEGMENTATION BENCHMARK         ")
    print("=======================================================")
    print(f"{'Method':<28} | {'Precision':<10} | {'Recall':<10} | {'F1-Score'}")
    print("-" * 65)
    print(f"{'Fixed-Window Baseline':<28} | {baseline_metrics['precision']*100:>8.1f}%  | {baseline_metrics['recall']*100:>8.1f}%  | {baseline_metrics['f1']*100:>7.1f}%")
    print(f"{'Multilingual Transformer':<28} | {transformer_metrics['precision']*100:>8.1f}%  | {transformer_metrics['recall']*100:>8.1f}%  | {transformer_metrics['f1']*100:>7.1f}%")
    print("-" * 65)
    f1_gain = (transformer_metrics['f1'] - baseline_metrics['f1']) * 100
    print(f"Absolute F1-Score Gain via Semantic Embeddings: +{f1_gain:.1f}%")
    print("=======================================================\n")

    return {
        "baseline": baseline_metrics,
        "transformer": transformer_metrics,
    }


if __name__ == "__main__":
    run_segmentation_evaluation()

