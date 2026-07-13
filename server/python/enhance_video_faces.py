# server/python/enhance_video_faces.py
import cv2
import torch
import sys
import os
import shutil
import argparse
from gfpgan import GFPGANer

def main():
    parser = argparse.ArgumentParser(description="GFPGAN Face Enhancement for generated videos.")
    parser.add_argument("--input", required=True, help="Input video path")
    parser.add_argument("--output", required=True, help="Output video path")
    args = parser.parse_args()

    input_video = os.path.abspath(args.input)
    output_video = os.path.abspath(args.output)

    print(f"[GFPGAN] Enhancing video face clarity: {input_video} -> {output_video}")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    gfpgan_checkpoint = os.path.join(project_root, 'gfpgan', 'GFPGANv1.4.pth')

    if not os.path.exists(gfpgan_checkpoint):
        print(f"[GFPGAN] Error: Checkpoint not found at {gfpgan_checkpoint}. Skipping enhancement.")
        shutil.copy2(input_video, output_video)
        sys.exit(0)

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"[GFPGAN] Loading model on device: {device}...")
    try:
        enhancer = GFPGANer(
            model_path=gfpgan_checkpoint,
            upscale=1,
            arch='clean',
            channel_multiplier=2,
            bg_upsampler=None,
            device=device
        )
    except Exception as e:
        print(f"[GFPGAN] Initialization failed: {e}. Skipping enhancement.")
        shutil.copy2(input_video, output_video)
        sys.exit(0)

    cap = cv2.VideoCapture(input_video)
    if not cap.isOpened():
        print(f"[GFPGAN] Error: Could not open video: {input_video}")
        shutil.copy2(input_video, output_video)
        sys.exit(0)

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    temp_out = output_video + ".temp.mp4"
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(temp_out, fourcc, fps, (width, height))

    print(f"[GFPGAN] Processing {total_frames} frames...")
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        try:
            _, _, restored_img = enhancer.enhance(
                frame,
                has_aligned=False,
                only_center_face=False,
                paste_back=True
            )
            out.write(restored_img)
        except Exception as e:
            out.write(frame)

        frame_idx += 1
        if frame_idx % 30 == 0:
            print(f"[GFPGAN] Processed {frame_idx}/{total_frames} frames...")

    cap.release()
    out.release()

    if os.path.exists(temp_out) and os.path.getsize(temp_out) > 0:
        if os.path.exists(output_video):
            os.remove(output_video)
        shutil.move(temp_out, output_video)
        print("[GFPGAN] Enhancement finished successfully!")
    else:
        print("[GFPGAN] Warning: Temp output video is empty. Copying input.")
        shutil.copy2(input_video, output_video)

if __name__ == '__main__':
    main()
