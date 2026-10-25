import json
from pathlib import Path


def levenshtein_distance(seq1: list, seq2: list) -> int:
    """Computes Levenshtein edit distance between two sequences (words or chars)."""
    m, n = len(seq1), len(seq2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if seq1[i - 1] == seq2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],     # deletion
                    dp[i][j - 1],     # insertion
                    dp[i - 1][j - 1]  # substitution
                )
    return dp[m][n]


def calculate_wer(reference: str, hypothesis: str) -> float:
    ref_words = reference.strip().lower().split()
    hyp_words = hypothesis.strip().lower().split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    dist = levenshtein_distance(ref_words, hyp_words)
    return dist / len(ref_words)


def calculate_cer(reference: str, hypothesis: str) -> float:
    ref_chars = list(reference.strip().lower())
    hyp_chars = list(hypothesis.strip().lower())
    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0
    dist = levenshtein_distance(ref_chars, hyp_chars)
    return dist / len(ref_chars)


def run_asr_evaluation():
    data_path = Path(__file__).parent / "data" / "ground_truth_asr.json"
    with open(data_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    baseline_wers = []
    post_wers = []
    baseline_cers = []
    post_cers = []

    print("\n=======================================================")
    print("           LECTURELENS ASR BENCHMARK RESULTS           ")
    print("=======================================================")
    print(f"{'Sample ID':<20} | {'Lang':<5} | {'Baseline WER':<12} | {'Post-Proc WER':<12} | {'Delta WER'}")
    print("-" * 65)

    for s in samples:
        ref = s["reference"]
        hyp_base = s["hypothesis_baseline"]
        hyp_post = s["hypothesis_postprocessed"]

        b_wer = calculate_wer(ref, hyp_base)
        p_wer = calculate_wer(ref, hyp_post)
        b_cer = calculate_cer(ref, hyp_base)
        p_cer = calculate_cer(ref, hyp_post)

        baseline_wers.append(b_wer)
        post_wers.append(p_wer)
        baseline_cers.append(b_cer)
        post_cers.append(p_cer)

        delta = p_wer - b_wer
        print(f"{s['sample_id']:<20} | {s['language']:<5} | {b_wer*100:>10.1f}% | {p_wer*100:>10.1f}% | {delta*100:>+8.1f}%")

    avg_b_wer = sum(baseline_wers) / len(baseline_wers)
    avg_p_wer = sum(post_wers) / len(post_wers)
    avg_b_cer = sum(baseline_cers) / len(baseline_cers)
    avg_p_cer = sum(post_cers) / len(post_cers)

    print("-" * 65)
    print(f"Overall Mean Baseline WER: {avg_b_wer * 100:.2f}%  |  Mean Baseline CER: {avg_b_cer * 100:.2f}%")
    print(f"Overall Mean Post-Proc WER: {avg_p_wer * 100:.2f}% |  Mean Post-Proc CER: {avg_p_cer * 100:.2f}%")
    print(f"Technical Glossary & Post-Proc Relative Improvement: {((avg_b_wer - avg_p_wer) / avg_b_wer) * 100:.1f}%")
    print("=======================================================\n")

    return {
        "baseline_wer": avg_b_wer,
        "postproc_wer": avg_p_wer,
        "baseline_cer": avg_b_cer,
        "postproc_cer": avg_p_cer,
    }


if __name__ == "__main__":
    run_asr_evaluation()

