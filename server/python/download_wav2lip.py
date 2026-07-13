# server/python/download_wav2lip.py
import sys
import os
import requests
from pathlib import Path

def download(url, dest_path):
    # Skip if file already exists and is non-empty (larger than 10MB)
    if dest_path.exists() and dest_path.stat().st_size > 10 * 1024 * 1024:
        print(f"✓ {dest_path.name} already exists. Skipping download.")
        return

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    with requests.get(url, headers=headers, stream=True) as r:
        r.raise_for_status()
        total = int(r.headers.get('content-length', 0))
        downloaded = 0
        with open(dest_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        percent = (downloaded / total) * 100
                        print(f"\rDownloading {dest_path.name}... {percent:.2f}%", end='')
    print(f'\nDownload completed: {dest_path}')

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('Usage: python download_wav2lip.py <wav2lip_dir>')
        sys.exit(1)
    
    wav2lip_dir = Path(sys.argv[1])
    
    # 1. Download wav2lip_gan.pth (recommended for visual quality)
    model_url = 'https://huggingface.co/Nekochu/Wav2Lip/resolve/main/wav2lip_gan.pth?download=true'
    model_dest = wav2lip_dir / 'wav2lip_gan.pth'
    
    # 2. Download face detection model s3fd.pth to Wav2Lip/face_detection/detection/sfd/s3fd.pth
    s3fd_url = 'https://huggingface.co/wsj1995/sadTalker/resolve/main/s3fd-619a316812.pth?download=true'
    s3fd_dest = wav2lip_dir / 'face_detection' / 'detection' / 'sfd' / 's3fd.pth'

    # 3. Download GFPGAN v1.4 checkpoint for image enhancement
    gfpgan_url = 'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth'
    gfpgan_dest = wav2lip_dir.parent / 'gfpgan' / 'GFPGANv1.4.pth'
    
    print("Checking Wav2Lip GAN model weights...")
    try:
        download(model_url, model_dest)
    except Exception as e:
        print(f"\nFailed to download GAN model: {e}")
        print("Trying standard Wav2Lip model instead...")
        standard_url = 'https://huggingface.co/Nekochu/Wav2Lip/resolve/main/wav2lip.pth?download=true'
        model_dest = wav2lip_dir / 'wav2lip.pth'
        download(standard_url, model_dest)

    print("\nChecking S3FD face detector weights...")
    # S3FD is around 85MB, so check size > 5MB
    if s3fd_dest.exists() and s3fd_dest.stat().st_size > 5 * 1024 * 1024:
        print("✓ s3fd.pth already exists. Skipping download.")
    else:
        download(s3fd_url, s3fd_dest)

    print("\nChecking GFPGAN v1.4 face restoration weights...")
    try:
        download(gfpgan_url, gfpgan_dest)
    except Exception as e:
        print(f"\nFailed to download GFPGAN model: {e}")
    
    print("\nSetup done! Checkpoints are saved successfully.")
