import subprocess
import sys

def main():
    try:
        # Run tasklist to list all running processes on Windows
        res = subprocess.run(["tasklist"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        print("--- RUNNING PROCESSES ---")
        lines = res.stdout.split("\n")
        node_lines = [l for l in lines if "node" in l.lower()]
        python_lines = [l for l in lines if "python" in l.lower()]
        
        print(f"Total node processes found: {len(node_lines)}")
        for nl in node_lines:
            print(nl)
            
        print(f"\nTotal python processes found: {len(python_lines)}")
        for pl in python_lines:
            print(pl)
            
    except Exception as e:
        print("Error listing processes:", e)

if __name__ == "__main__":
    main()
