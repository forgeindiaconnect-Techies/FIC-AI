import os
from huggingface_hub import HfApi

def main():
    api = HfApi()
    try:
        print("Searching all spaces containing 'liveportrait'...")
        # Search for spaces with "liveportrait" in the name
        spaces = api.list_spaces(search="liveportrait")
        
        results = []
        for s in spaces:
            # Get runtime stage
            runtime = getattr(s, 'runtime', None)
            stage = runtime.stage if runtime else "UNKNOWN"
            results.append(f"Space: {s.id} | Stage: {stage}")
            print(f"- {s.id} ({stage})")
            
        output = "Spaces found:\n" + "\n".join(results)
        with open("liveportrait_test_error.txt", "w", encoding="utf-8") as f:
            f.write(output)
            
    except Exception as e:
        with open("liveportrait_test_error.txt", "w", encoding="utf-8") as f:
            f.write(f"Error: {e}")

if __name__ == "__main__":
    main()
