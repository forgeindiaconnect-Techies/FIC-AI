import sys
import os
import argparse
import asyncio
import subprocess

async def amain():
    parser = argparse.ArgumentParser(description="Edge TTS Generator")
    # Accept either --text (inline) or --text-file (path to a text file)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--text", help="Text to synthesize inline")
    group.add_argument("--text-file", help="Path to a UTF-8 text file containing the script")
    parser.add_argument("--voice", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    # Read text from file if provided (avoids shell arg length/escaping issues)
    if args.text_file:
        with open(args.text_file, "r", encoding="utf-8") as f:
            text = f.read().strip()
    else:
        text = args.text

    if not text:
        print("[Edge-TTS] ERROR: No text to synthesize.")
        sys.exit(1)

    # Make sure edge-tts is installed
    try:
        import edge_tts
    except ImportError:
        print("[Edge-TTS] Installing edge-tts library...")
        subprocess.run([sys.executable, "-m", "pip", "install", "edge-tts"], check=True)
        import edge_tts

    print(f"[Edge-TTS] Synthesizing {len(text)} chars with voice '{args.voice}'...")
    communicate = edge_tts.Communicate(text, args.voice)
    await communicate.save(args.output)
    print(f"[Edge-TTS] Synthesized successfully to: {args.output}")

if __name__ == "__main__":
    asyncio.run(amain())
