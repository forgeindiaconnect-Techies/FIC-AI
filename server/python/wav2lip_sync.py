# server/python/wav2lip_sync.py
"""Simple wrapper for Wav2Lip.
This script expects the Wav2Lip repository to be installed and its
pre‑trained model file (e.g., "wav2lip.pth" or "wav2lip_gan.pth") to be available.
Usage:
  python wav2lip_sync.py --image <portrait.jpg> --audio <audio.wav> --output <out.mp4>
  python wav2lip_sync.py --test
"""
import argparse
import subprocess
import os
import sys

def get_paths():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    wav2lip_dir = os.path.join(project_root, 'Wav2Lip')
    if not os.path.isdir(wav2lip_dir):
        wav2lip_dir = os.path.join(project_root, 'wav2lip')
    return project_root, wav2lip_dir

def test_checkpoints():
    print("Starting sanity checks...")
    project_root, wav2lip_dir = get_paths()
    if not os.path.isdir(wav2lip_dir):
        print('❌ Error: Wav2Lip folder not found at', wav2lip_dir)
        return False
    print(f"✓ Found Wav2Lip directory: {wav2lip_dir}")

    # Check for wav2lip checkpoints in Wav2Lip/ or Wav2Lip/checkpoints/
    checkpoint_path = os.path.join(wav2lip_dir, 'wav2lip_gan.pth')
    if not os.path.exists(checkpoint_path):
        checkpoint_path = os.path.join(wav2lip_dir, 'checkpoints', 'wav2lip_gan.pth')
        if not os.path.exists(checkpoint_path):
            checkpoint_path = os.path.join(wav2lip_dir, 'wav2lip.pth')
            if not os.path.exists(checkpoint_path):
                checkpoint_path = os.path.join(wav2lip_dir, 'checkpoints', 'wav2lip.pth')
                if not os.path.exists(checkpoint_path):
                    print('❌ Error: Wav2Lip checkpoint (wav2lip.pth or wav2lip_gan.pth) not found.')
                    return False
    print(f"✓ Found Wav2Lip checkpoint: {checkpoint_path}")

    # Check for face detection model
    sfd_dir = os.path.join(wav2lip_dir, 'face_detection', 'detection', 'sfd')
    sfd_path = os.path.join(sfd_dir, 's3fd-619a316812.pth')
    if not os.path.exists(sfd_path):
        sfd_path = os.path.join(sfd_dir, 's3fd.pth')
        if not os.path.exists(sfd_path):
            root_sfd = os.path.join(wav2lip_dir, 's3fd-619a316812.pth')
            if os.path.exists(root_sfd):
                os.makedirs(sfd_dir, exist_ok=True)
                import shutil
                shutil.copy2(root_sfd, os.path.join(sfd_dir, 's3fd.pth'))
                sfd_path = os.path.join(sfd_dir, 's3fd.pth')
            else:
                print('❌ Error: S3FD face detector checkpoint not found in', sfd_dir)
                return False
    print(f"✓ Found S3FD checkpoint: {sfd_path}")

    # Check torch loading
    try:
        import torch
        print(f"✓ PyTorch version: {torch.__version__}")
        print("Loading Wav2Lip checkpoint to CPU/GPU...")
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"Using device: {device}")
        checkpoint = torch.load(checkpoint_path, map_location=device)
        print("✓ Wav2Lip checkpoint loaded successfully!")
    except ImportError:
        print("⚠ PyTorch is not installed in the current environment.")
    except Exception as e:
        print(f"❌ Error loading checkpoint: {e}")
        return False

    print("✅ All checkpoints are valid and ready!")
    return True

def main():
    parser = argparse.ArgumentParser(description='Run Wav2Lip lip‑sync')
    parser.add_argument('--image', help='Path to portrait image')
    parser.add_argument('--audio', help='Path to audio file (wav)')
    parser.add_argument('--output', help='Path for generated video')
    parser.add_argument('--test', action='store_true', help='Perform sanity test of checkpoints')
    args = parser.parse_args()

    if args.test:
        success = test_checkpoints()
        sys.exit(0 if success else 1)

    if not args.image or not args.audio or not args.output:
        parser.print_help()
        sys.exit(1)

    project_root, wav2lip_dir = get_paths()
    if not os.path.isdir(wav2lip_dir):
        print('Wav2Lip repo not found at', wav2lip_dir, file=sys.stderr)
        sys.exit(1)

    # Check for wav2lip checkpoints in Wav2Lip/ or Wav2Lip/checkpoints/
    checkpoint_path = os.path.join(wav2lip_dir, 'wav2lip_gan.pth')
    if not os.path.exists(checkpoint_path):
        checkpoint_path = os.path.join(wav2lip_dir, 'checkpoints', 'wav2lip_gan.pth')
        if not os.path.exists(checkpoint_path):
            checkpoint_path = os.path.join(wav2lip_dir, 'wav2lip.pth')
            if not os.path.exists(checkpoint_path):
                checkpoint_path = os.path.join(wav2lip_dir, 'checkpoints', 'wav2lip.pth')
                if not os.path.exists(checkpoint_path):
                    print('Wav2Lip checkpoint (wav2lip.pth or wav2lip_gan.pth) not found inside', wav2lip_dir, file=sys.stderr)
                    sys.exit(1)

    # Check for face detection model (s3fd.pth or s3fd-619a316812.pth) inside Wav2Lip/face_detection/detection/sfd/
    sfd_dir = os.path.join(wav2lip_dir, 'face_detection', 'detection', 'sfd')
    sfd_path = os.path.join(sfd_dir, 's3fd-619a316812.pth')
    if not os.path.exists(sfd_path):
        sfd_path = os.path.join(sfd_dir, 's3fd.pth')
        if not os.path.exists(sfd_path):
            # Fallback to copy from root if downloaded there
            root_sfd = os.path.join(wav2lip_dir, 's3fd-619a316812.pth')
            if os.path.exists(root_sfd):
                os.makedirs(sfd_dir, exist_ok=True)
                import shutil
                shutil.copy2(root_sfd, os.path.join(sfd_dir, 's3fd.pth'))
                sfd_path = os.path.join(sfd_dir, 's3fd.pth')
            else:
                print('S3FD face detector checkpoint not found in', sfd_dir, file=sys.stderr)
                sys.exit(1)

    cmd = [
        sys.executable, os.path.join(wav2lip_dir, 'inference.py'),
        '--checkpoint_path', checkpoint_path,
        '--face', args.image,
        '--audio', args.audio,
        '--outfile', args.output,
        '--static', 'True',  # must specify a value since it is defined with type=bool in argparse
    ]
    
    # Ensure temp directory exists inside Wav2Lip to avoid ffmpeg errors
    os.makedirs(os.path.join(wav2lip_dir, 'temp'), exist_ok=True)

    print(f"Running Wav2Lip command in CWD {wav2lip_dir}: {' '.join(cmd)}")
    # Run the command and forward output
    result = subprocess.run(cmd, cwd=wav2lip_dir, capture_output=True, text=True)
    if result.returncode != 0:
        print('Wav2Lip failed:', result.stderr, file=sys.stderr)
        sys.exit(result.returncode)
    print('Wav2Lip completed, video saved to', args.output)

if __name__ == '__main__':
    main()
