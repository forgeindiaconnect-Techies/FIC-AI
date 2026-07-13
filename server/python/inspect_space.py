# server/python/inspect_space.py
import sys
import os
from gradio_client import Client

def main():
    hf_token = os.environ.get("HF_API_KEY")
    print(f"Using HF API Token: {hf_token[:8] if hf_token else 'None'}...")
    try:
        client = Client("KwaiVGI/LivePortrait", hf_token=hf_token)
        print("Connected successfully!")
        print("Available Endpoints:")
        api_info = client.view_api(return_format="str")
        print(api_info)
        with open("space_api_info.txt", "w", encoding="utf-8") as f:
            f.write(api_info)
        print("Written space_api_info.txt")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
