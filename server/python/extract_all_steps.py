import os
import json
import re

def main():
    transcript_path = r"C:\Users\Forgeindiaconnect\.gemini\antigravity-ide\brain\06c134e2-660d-400e-a909-cfb4182aeaa1\.system_generated\logs\transcript_full.jsonl"
    if not os.path.exists(transcript_path):
        transcript_path = os.path.join(os.path.dirname(__file__), "..", "..", ".system_generated", "logs", "transcript_full.jsonl")
        
    print(f"Reading from: {transcript_path}")
    
    # We will collect all chunks of code with their line numbers
    reconstructed_lines = {}
    
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line_str in f:
            if "liveportrait_animate.py" in line_str and "Total Lines:" in line_str:
                try:
                    data = json.loads(line_str)
                    content = data.get("content", "")
                    if "Total Lines:" in content:
                        # Extract the lines
                        # Format is "<line_number>: <code_line>"
                        for match in re.finditer(r"^(\d+):\s*(.*)$", content, re.MULTILINE):
                            line_num = int(match.group(1))
                            line_content = match.group(2)
                            reconstructed_lines[line_num] = line_content
                except Exception as ex:
                    print(f"Error parsing line: {ex}")
                    
    if reconstructed_lines:
        max_line = max(reconstructed_lines.keys())
        print(f"Reconstructed {len(reconstructed_lines)} lines up to line {max_line}")
        
        # Write to file
        with open("liveportrait_reconstructed_full.py", "w", encoding="utf-8") as out:
            for i in range(1, max_line + 1):
                # If a line is missing, write a placeholder comment
                line_text = reconstructed_lines.get(i, f"# MISSING LINE {i}")
                out.write(line_text + "\n")
        print("Done! Reconstructed file written to liveportrait_reconstructed_full.py")
    else:
        print("No code chunks found in transcript.")

if __name__ == "__main__":
    main()
