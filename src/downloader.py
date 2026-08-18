"""
Model Downloader Utility
Ensures official Google MediaPipe task models are cached locally.
"""

import sys
import urllib.request
from pathlib import Path
from typing import Optional, Callable
from src.config import MODEL_URLS, MODEL_PATHS, MODELS_DIR

def _reporthook(block_num: int, block_size: int, total_size: int, task_name: str) -> None:
    """Displays download progress in the terminal."""
    if total_size > 0:
        downloaded = block_num * block_size
        percent = min(100.0, downloaded * 100.0 / total_size)
        mb_downloaded = downloaded / (1024 * 1024)
        mb_total = total_size / (1024 * 1024)
        sys.stdout.write(f"\rDownloading {task_name}... {percent:.1f}% ({mb_downloaded:.1f}/{mb_total:.1f} MB)")
        sys.stdout.flush()
    else:
        sys.stdout.write(f"\rDownloading {task_name}... ({block_num * block_size / 1024:.1f} KB)")
        sys.stdout.flush()

def download_model(model_name: str, force: bool = False, verbose: bool = True) -> Path:
    """
    Downloads a MediaPipe task model if not already present.
    
    Args:
        model_name: Name of model in MODEL_URLS (e.g. 'face_landmarker', 'pose_landmarker', 'hand_landmarker')
        force: If True, re-downloads even if the file exists.
        verbose: If True, prints progress.
        
    Returns:
        Path to the downloaded model file.
    """
    if model_name not in MODEL_URLS:
        raise ValueError(f"Unknown model name: {model_name}. Available: {list(MODEL_URLS.keys())}")
    
    target_path = MODEL_PATHS[model_name]
    url = MODEL_URLS[model_name]
    
    if target_path.exists() and target_path.stat().st_size > 1024 and not force:
        if verbose:
            print(f"[OK] Model '{model_name}' found at: {target_path}")
        return target_path
    
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    if verbose:
        print(f"[>>] Downloading '{model_name}' model from: {url}")
        
    try:
        hook: Optional[Callable[[int, int, int], None]] = (
            (lambda b, bs, ts: _reporthook(b, bs, ts, model_name)) if verbose else None
        )
        urllib.request.urlretrieve(url, str(target_path), reporthook=hook)
        if verbose:
            print(f"\n[OK] Successfully downloaded '{model_name}' ({target_path.stat().st_size / (1024 * 1024):.2f} MB)")
    except Exception as e:
        if target_path.exists():
            target_path.unlink(missing_ok=True)
        raise RuntimeError(f"Failed to download model '{model_name}' from {url}: {e}") from e

    return target_path

def ensure_all_models(verbose: bool = True) -> None:
    """Ensures all required models are downloaded."""
    if verbose:
        print("Checking required MediaPipe vision task models...")
    for model_name in MODEL_URLS:
        download_model(model_name, verbose=verbose)
    if verbose:
        print("All models verified successfully.\n")

if __name__ == "__main__":
    ensure_all_models(verbose=True)
