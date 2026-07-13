import os
import json
import re

def main():
    transcript_path = r"C:\Users\Forgeindiaconnect\.gemini\antigravity-ide\brain\06c134e2-660d-400e-a909-cfb4182aeaa1\.system_generated\logs\transcript_full.jsonl"
    if not os.path.exists(transcript_path):
        transcript_path = os.path.join(os.path.dirname(__file__), "..", "..", ".system_generated", "logs", "transcript_full.jsonl")
        
    print(f"Reading from: {transcript_path}")
    
    clean_lines = {}
    
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line_str in f:
            if "liveportrait_animate.py" in line_str and "Total Lines: 30" in line_str:
                # This is a view of liveportrait_animate.py!
                # Let's extract all matches of "<line_number>: <content>"
                # e.g. "8: # server/python/liveportrait_animate.py"
                matches = re.findall(r"^\s*(\d+):\s*(.*)$", line_str, re.MULTILINE)
                if not matches:
                    # try within JSON string (newlines escaped as \n)
                    matches = re.findall(r"(?:\\n|^)\s*(\d+):\s*([^\\]*)", line_str)
                    
                for line_num_str, line_content in matches:
                    try:
                        line_num = int(line_num_str)
                        # We only want lines up to 309
                        if line_num > 0 and line_num <= 310:
                            # Keep the line content if not seen, or if this version doesn't have markdown escape characters
                            if line_num not in clean_lines or len(line_content) > len(clean_lines[line_num]):
                                # Clean up escapes like \r or \"
                                clean_content = line_content.replace("\\\"", "\"").replace("\\\\", "\\").strip("\r")
                                clean_lines[line_num] = clean_content
                    except ValueError:
                        pass
                        
    if clean_lines:
        max_line = max(clean_lines.keys())
        print(f"Reconstructed {len(clean_lines)} lines up to line {max_line}")
        
        with open("liveportrait_animate_clean.py", "w", encoding="utf-8") as out:
            for i in range(1, max_line + 1):
                line_text = clean_lines.get(i, "")
                out.write(line_text + "\n")
        print("✓ Wrote clean reconstructed code to liveportrait_animate_clean.py!")
    else:
        print("❌ Could not find clean views of liveportrait_animate.py.")

if __name__ == "__main__":
    main()
