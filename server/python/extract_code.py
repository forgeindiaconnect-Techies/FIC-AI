import subprocess
import os

def main():
    try:
        print("Restoring liveportrait_animate.py using git from python...")
        # Get python folder path
        py_dir = os.path.dirname(os.path.abspath(__file__))
        project_dir = os.path.dirname(py_dir) # forge-ai/server
        
        # Run git checkout
        res = subprocess.run(
            ["git", "checkout", "--", "python/liveportrait_animate.py"],
            cwd=project_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        print("STDOUT:", res.stdout)
        print("STDERR:", res.stderr)
        print("Exit Code:", res.returncode)
        
        if res.returncode == 0:
            print("✓ Successfully restored liveportrait_animate.py from git!")
        else:
            print("❌ Git checkout failed.")
    except Exception as e:
        print("Error running git:", e)

if __name__ == "__main__":
    main()
