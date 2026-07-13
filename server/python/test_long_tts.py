"""
Test that a long spoken script (800+ chars with apostrophes, commas, etc)
is correctly synthesized by the Edge-TTS backend via the /api/video/tts endpoint.
"""
import urllib.request
import urllib.parse
import ssl
import os

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Simulate a full Gemini-generated voiceover script (HTML explanation)
long_script = (
    "Hello and welcome! Today, let's talk about HTML, which stands for HyperText Markup Language. "
    "HTML is the foundation of every web page you have ever visited. It is the standard language "
    "used to create and structure content on the web. Let me explain what this means. "
    "When you open a website, your browser reads HTML code and turns it into the visual page you see, "
    "with text, images, buttons, and links. "
    "HTML works by using tags, which are special instructions written inside angle brackets. "
    "For example, the tag called 'p' creates a paragraph, and 'h1' creates a large heading. "
    "These tags tell the browser how to display the content. "
    "In other words, HTML is like the skeleton of a web page — it gives structure to everything. "
    "So essentially, if you want to build a website, HTML is the very first thing you need to learn. "
    "It is simple, powerful, and used by millions of developers worldwide every single day."
)

print(f"Script length: {len(long_script)} chars")
encoded = urllib.parse.quote(long_script)
url = f"http://localhost:5001/api/video/tts?text={encoded}&lang=english&gender=male&t=123456"

print("Requesting TTS audio from server...")
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
        print(f"SUCCESS! Audio bytes received: {len(data)}")
        if len(data) > 50000:
            print("✓ FULL AUDIO: Script is being spoken completely (large file = full explanation)")
        elif len(data) > 10000:
            print("⚠ PARTIAL: Audio generated but may be truncated")
        else:
            print("✗ TOO SHORT: Audio is too small — likely only a fragment is being spoken")
        # Save for manual verification
        out_path = os.path.join(os.path.dirname(__file__), 'test_long_tts_output.mp3')
        with open(out_path, 'wb') as f:
            f.write(data)
        print(f"Saved audio to: {out_path}")
except Exception as e:
    print(f"ERROR: {e}")
