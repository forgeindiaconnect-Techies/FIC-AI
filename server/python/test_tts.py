import urllib.request
import urllib.parse
import os

def test_tts():
    text = "Hello, this is a test of the male voice presentation."
    encoded_text = urllib.parse.quote(text)
    
    # 1. Fetch female TTS
    url_female = f"http://localhost:5001/api/video/tts?text={encoded_text}&lang=english&gender=female"
    print(f"Fetching female TTS: {url_female}")
    try:
        req = urllib.request.Request(url_female, headers={'User-Agent': 'Mozilla/5.5'})
        with urllib.request.urlopen(req) as response:
            female_data = response.read()
            print(f"Female voice bytes received: {len(female_data)}")
    except Exception as e:
        print(f"Female TTS failed: {e}")
        return
        
    # 2. Fetch male TTS
    url_male = f"http://localhost:5001/api/video/tts?text={encoded_text}&lang=english&gender=male"
    print(f"Fetching male TTS: {url_male}")
    try:
        req = urllib.request.Request(url_male, headers={'User-Agent': 'Mozilla/5.5'})
        with urllib.request.urlopen(req) as response:
            male_data = response.read()
            print(f"Male voice bytes received: {len(male_data)}")
            
        if female_data == male_data:
            print("❌ WARNING: Female and Male TTS audio data are EXACTLY IDENTICAL! The backend is ignoring gender!")
        else:
            print("✓ SUCCESS: Female and Male TTS audio data are DIFFERENT! Gender is working correctly at API level.")
            
        # Save both to check
        with open("test_female.mp3", "wb") as f:
            f.write(female_data)
        with open("test_male.mp3", "wb") as f:
            f.write(male_data)
            
    except Exception as e:
        print(f"Male TTS failed: {e}")

if __name__ == "__main__":
    test_tts()
