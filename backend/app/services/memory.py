import ctypes
import gc
import logging
import os
import platform
import resource
from typing import Optional

logger = logging.getLogger("lecturelens.memory")

# Load libc for malloc_trim on Linux glibc environments (like Render Debian/Ubuntu base)
_libc = None
if platform.system() == "Linux":
    try:
        _libc = ctypes.CDLL("libc.so.6")
    except Exception as e:
        logger.debug(f"Unable to load libc.so.6 for malloc_trim: {e}")


def get_current_rss_mb() -> float:
    """Returns the current Resident Set Size (RSS) in megabytes.
    On Linux, reads VmRSS from /proc/self/status for real-time memory after trim.
    On macOS/BSD, falls back to resource.getrusage (ru_maxrss).
    """
    if os.path.exists("/proc/self/status"):
        try:
            with open("/proc/self/status", "r") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        parts = line.split()
                        if len(parts) >= 2:
                            return round(float(parts[1]) / 1024.0, 2)
        except Exception:
            pass

    # Fallback to getrusage
    usage = resource.getrusage(resource.RUSAGE_SELF)
    if platform.system() == "Darwin":
        # macOS returns bytes
        return round(usage.ru_maxrss / (1024.0 * 1024.0), 2)
    else:
        # Linux / other Unix returns kilobytes
        return round(usage.ru_maxrss / 1024.0, 2)


def get_peak_rss_mb() -> float:
    """Returns the peak RSS in megabytes using getrusage."""
    usage = resource.getrusage(resource.RUSAGE_SELF)
    if platform.system() == "Darwin":
        return round(usage.ru_maxrss / (1024.0 * 1024.0), 2)
    return round(usage.ru_maxrss / 1024.0, 2)


def cleanup_memory(tag: str = "general") -> float:
    """Forces garbage collection and releases unmapped heap memory back to the OS.
    Crucial on memory-constrained platforms like Render (512MB / 1GB RAM limits)
    where glibc retains freed pages unless malloc_trim is explicitly called.
    """
    rss_before = get_current_rss_mb()

    # 1. Run Python Garbage Collector across all generations
    gc.collect()

    # 2. Release PyTorch CUDA / MPS cache if available
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    # 3. Release glibc heap back to OS kernel (Linux / Render)
    if _libc and hasattr(_libc, "malloc_trim"):
        try:
            _libc.malloc_trim(0)
        except Exception as e:
            logger.debug(f"malloc_trim call failed: {e}")

    rss_after = get_current_rss_mb()
    logger.info(
        f"[Memory Cleanup: {tag}] RSS before: {rss_before:.1f}MB -> after: {rss_after:.1f}MB "
        f"(Freed: {max(0.0, rss_before - rss_after):.1f}MB, Peak: {get_peak_rss_mb():.1f}MB)"
    )
    return rss_after


def log_memory_status(label: str = "Status"):
    """Logs the current and peak memory consumption."""
    current = get_current_rss_mb()
    peak = get_peak_rss_mb()
    logger.info(f"[Memory {label}] Current RSS: {current:.1f}MB | Peak RSS: {peak:.1f}MB")
