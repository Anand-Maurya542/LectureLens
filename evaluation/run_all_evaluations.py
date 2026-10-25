import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from evaluation.evaluate_asr import run_asr_evaluation
from evaluation.evaluate_segmentation import run_segmentation_evaluation
from evaluation.evaluate_retrieval import run_retrieval_evaluation


def main():
    print("\n" + "=" * 70)
    print("      LECTURELENS COMPREHENSIVE AI & EVALUATION BENCHMARK SUITE       ")
    print("=" * 70)

    # 1. ASR Benchmark
    asr_res = run_asr_evaluation()

    # 2. Topic Segmentation Benchmark
    seg_res = run_segmentation_evaluation()

    # 3. Retrieval Benchmark
    ret_res = run_retrieval_evaluation()

    print("\n" + "=" * 70)
    print("                      EVALUATION SUMMARY                      ")
    print("=" * 70)
    print(f"• ASR Word Error Rate: {asr_res['postproc_wer']*100:.1f}% (CER: {asr_res['postproc_cer']*100:.1f}%)")
    print(f"• Segmentation F1-Score: {seg_res['transformer']['f1']*100:.1f}% (vs {seg_res['baseline']['f1']*100:.1f}% fixed baseline)")
    print(f"• Semantic Retrieval MRR: {ret_res['Atlas Vector Search (Semantic Cosine)']['mrr']:.3f} (Recall@3: {ret_res['Atlas Vector Search (Semantic Cosine)']['recall@3']*100:.1f}%)")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()

