import urllib.request
import urllib.parse
import ssl

def main():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    text = "Hello, this is a test of the male voice presentation."
    encoded_text = urllib.parse.quote(text)
    
    voices = ['Salli', 'Brian', 'Joey', 'Matthew', 'Amy']
    
    for v in voices:
        url = f"https://api.streamelements.com/api/v2/speech?voice={v}&text={encoded_text}"
        print(f"Testing StreamElements voice: {v}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
                data = response.read()
                print(f"Success! Bytes: {len(data)}")
        except Exception as e:
            print(f"Failed for voice {v}: {e}")

if __name__ == "__main__":
    main()
