import sys
from huggingface_hub import HfApi

def main():
    api = HfApi()
    try:
        print("Searching Hugging Face spaces for 'LivePortrait'...")
        spaces = api.list_spaces(search="LivePortrait", limit=50)
        
        active_spaces = []
        for s in spaces:
            # Check if running
            try:
                runtime = getattr(s, 'runtime', None)
                stage = runtime.stage if runtime else None
                # Filter for running spaces
                if stage == 'RUNNING' or stage == 'running':
                    active_spaces.append(s.id)
                    print(f"✓ Found running space: {s.id}")
            except Exception:
                pass
                
        print(f"\nTotal active spaces found: {len(active_spaces)}")
        print("Active space IDs:", active_spaces)
    except Exception as e:
        print(f"Error listing spaces: {e}")

if __name__ == "__main__":
    main()
