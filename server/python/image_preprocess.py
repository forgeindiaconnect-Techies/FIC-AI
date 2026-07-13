# server/python/image_preprocess.py
import argparse
import os
import sys
import shutil
import numpy as np

def enhance_opencv(input_path, output_path):
    """
    Enhances image clarity and contrast using standard OpenCV filters.
    Provides sharpening, contrast correction (CLAHE), and slight denoising.
    """
    import cv2
    print("[Preprocess] Using OpenCV filters for sharpening and contrast enhancement...")
    img = cv2.imread(input_path)
    if img is None:
        raise ValueError(f"Failed to read image from {input_path}")

    # 1. Contrast Adjustment (CLAHE in LAB color space to avoid distorting colors)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl, a, b))
    enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

    # 2. Detail Sharpening (Unsharp Masking)
    gaussian = cv2.GaussianBlur(enhanced, (9, 9), 10.0)
    sharpened = cv2.addWeighted(enhanced, 1.5, gaussian, -0.5, 0)

    # 3. Save output
    cv2.imwrite(output_path, sharpened)
    print(f"[Preprocess] Saved enhanced image to: {output_path}")

def enhance_gfpgan(input_path, output_path, checkpoint_path):
    """
    Applies GFPGAN for high-quality face restoration.
    """
    import cv2
    from gfpgan import GFPGANer
    
    print("[Preprocess] Running GFPGAN face restoration...")
    
    # Load GFPGAN restorer
    # model_path should point to the downloaded GFPGAN clean/v1.3/v1.4 weight
    restorer = GFPGANer(
        model_path=checkpoint_path,
        upscale=2,
        arch='clean',
        channel_multiplier=2,
        bg_upsampler=None
    )
    
    img = cv2.imread(input_path)
    if img is None:
        raise ValueError(f"Failed to read image from {input_path}")
        
    cropped_faces, restored_faces, restored_img = restorer.enhance(
        img,
        has_aligned=False,
        only_center_face=False,
        paste_back=True
    )
    
    if restored_img is not None:
        cv2.imwrite(output_path, restored_img)
        print(f"[Preprocess] Face restoration completed. Output: {output_path}")
    else:
        raise RuntimeError("GFPGAN enhancement returned empty image.")

def main():
    parser = argparse.ArgumentParser(description="Image enhancement and face restoration preprocessing.")
    parser.add_argument("--input", required=True, help="Path to raw uploaded image")
    parser.add_argument("--output", required=True, help="Path to write enhanced image")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Resolve checkpoints path relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    gfpgan_checkpoint = os.path.join(project_root, 'gfpgan', 'GFPGANv1.4.pth')

    # Try GFPGAN first if the library is installed and weight file exists
    try:
        if os.path.exists(gfpgan_checkpoint):
            import torch
            from gfpgan import GFPGANer
            enhance_gfpgan(input_path, output_path, gfpgan_checkpoint)
            return
        else:
            print(f"[Preprocess] GFPGAN checkpoint not found at {gfpgan_checkpoint}. Falling back to OpenCV.")
    except ImportError:
        print("[Preprocess] gfpgan or torch library is missing. Falling back to OpenCV.")
    except Exception as e:
        print(f"[Preprocess] GFPGAN failed: {e}. Falling back to OpenCV.")

    # OpenCV Fallback
    try:
        import cv2
        enhance_opencv(input_path, output_path)
    except Exception as e:
        print(f"[Preprocess] OpenCV enhancement failed: {e}. Copying original image.")
        shutil.copy2(input_path, output_path)

if __name__ == "__main__":
    main()
