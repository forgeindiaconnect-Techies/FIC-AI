import os
import sys

def test_space(space_id):
    try:
        from gradio_client import Client
        print(f"Testing space: {space_id}...")
        client = Client(space_id)
        # Check if endpoints exist and list them
        info = client.view_api(return_format="str")
        if "/gpu_wrapped_execute_video" in info:
            print(f"✓ Space {space_id} is ACTIVE and supports /gpu_wrapped_execute_video!")
            return True, info
        else:
            print(f"✗ Space {space_id} is active but does not support video endpoint.")
            return False, ""
    except Exception as e:
        print(f"✗ Space {space_id} failed: {e}")
        return False, ""

def main():
    candidates = [
        "innoai/LivePortrait",
        "doctorjazz/LivePortraits",
        "K00B404/LivePortrait_cpu",
        "fcyai/LivePortrait",
        "smartdigitalnetworks/Live-Portrait"
    ]
    
    successful = []
    for c in candidates:
        ok, info = test_space(c)
        if ok:
            successful.append(c)
            # Write endpoints description to a file for reference
            with open(f"space_{c.replace('/', '_')}_api.txt", "w", encoding="utf-8") as f:
                f.write(info)
                
    output = "Successful spaces:\n" + "\n".join(successful)
    with open("liveportrait_test_error.txt", "w", encoding="utf-8") as f:
        f.write(output)

if __name__ == "__main__":
    main()
