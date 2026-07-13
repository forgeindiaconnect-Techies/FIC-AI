# server/python/fomm_motion.py
"""Simple wrapper for First‑Order Motion Model (FOMM).
The script expects the FOMM repository to be cloned at ./first-order-model
and a pretrained checkpoint (e.g., `checkpoints/demo.ckpt`) to be present.
If the repo or checkpoint cannot be found, the script falls back to copying
the input lip‑sync video unchanged (so at least you get lip‑sync).

Usage:
  python fomm_motion.py \
    --image <portrait.jpg> \
    --audio <audio.wav>   # (not used here but kept for symmetry) \
    --input-video <lipsync.mp4> \
    --output <motion.mp4>
"""
import argparse
import os
import shutil
import subprocess
import sys

def run_fomm(image_path, input_video_path, output_path):
    # Assume the FOMM repo is at ./first-order-model relative to the project root
    repo_dir = os.path.join(os.getcwd(), "first-order-model")
    if not os.path.isdir(repo_dir):
        print("[FOMM] Repo not found at", repo_dir, file=sys.stderr)
        return False

    # Path to the demo script inside the repo (common entry point)
    demo_script = os.path.join(repo_dir, "demo.py")
    if not os.path.isfile(demo_script):
        print("[FOMM] demo.py not found in repo", file=sys.stderr)
        return False

    # Use a generic driving video – we reuse the cached girl presenter
    driving_video = os.path.join(os.getcwd(), "server", "uploads", "video", "girl_presenter.mp4")
    if not os.path.isfile(driving_video):
        print("[FOMM] Driving video not found at", driving_video, file=sys.stderr)
        return False

    # Build the command (the demo script uses arguments: --source_image, --driving_video, --result_video)
    cmd = [
        "python", demo_script,
        "--source_image", image_path,
        "--driving_video", driving_video,
        "--result_video", output_path,
        # Optional: limit to 2‑second clip for speed
        "--checkpoint", os.path.join(repo_dir, "checkpoints", "demo.ckpt"),
        "--relative", "True",
        "--adapt_movement_scale", "True"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print("[FOMM] Error:\n", result.stderr, file=sys.stderr)
            return False
        print("[FOMM] Success, motion video saved to", output_path)
        return True
    except Exception as e:
        print("[FOMM] Exception while running:", e, file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Run First‑Order Motion Model to add body/head motion')
    parser.add_argument('--image', required=True, help='Portrait image path')
    parser.add_argument('--audio', required=False, help='Audio path (unused, kept for symmetry)')
    parser.add_argument('--input-video', required=True, help='Lip‑sync video from Wav2Lip')
    parser.add_argument('--output', required=True, help='Path for motion‑augmented video')
    args = parser.parse_args()

    # Try to run FOMM; on any failure, just copy the lip‑sync video.
    success = run_fomm(args.image, args.input_video, args.output)
    if not success:
        # Fallback – copy the input video so the pipeline can continue.
        shutil.copyfile(args.input_video, args.output)
        print('[FOMM] Fallback: copied lip‑sync video to', args.output)

if __name__ == '__main__':
    main()
