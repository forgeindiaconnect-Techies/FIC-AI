import sys
import os
import argparse
import shutil
import subprocess

def get_video_duration(video_path):
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        cap.release()
        if fps > 0:
            return frame_count / fps
    except Exception as e:
        print(f"Failed to get video duration: {e}")
    return 0

def split_video(video_path, chunk_duration, output_dir, ffmpeg_path):
    os.makedirs(output_dir, exist_ok=True)
    out_pattern = os.path.join(output_dir, "part_%03d.mp4")
    cmd = [
        ffmpeg_path, "-y", "-i", video_path, 
        "-f", "segment", "-segment_time", str(chunk_duration),
        "-reset_timestamps", "1",
        "-c:v", "libx264", "-c:a", "aac", out_pattern
    ]
    print(f"[LivePortrait] Splitting video: {' '.join(cmd)}")
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    parts = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.startswith("part_") and f.endswith(".mp4")])
    return parts

def concatenate_videos(video_paths, output_path, ffmpeg_path):
    temp_list = output_path + ".list.txt"
    with open(temp_list, "w", encoding="utf-8") as f:
        for vp in video_paths:
            escaped_path = vp.replace("\\", "/")
            f.write(f"file '{escaped_path}'\n")
    cmd = [
        ffmpeg_path, "-y", "-f", "concat", "-safe", "0", 
        "-i", temp_list, "-c", "copy", output_path
    ]
    print(f"[LivePortrait] Concatenating parts: {' '.join(cmd)}")
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(temp_list):
        try: os.remove(temp_list)
        except: pass

def animate_single_video(client, source_image, video_path):
    from gradio_client import handle_file
    source_image_input = handle_file(source_image)
    driving_video_input = {
        "video": handle_file(video_path),
        "subtitles": None
    }
    errors = []
    # Try different predict forms (positional vs keyword arguments)
    try:
        res = client.predict(
            source_image_input,
            driving_video_input,
            True,
            True,
            True,
            api_name="/gpu_wrapped_execute_video"
        )
        if res: return res
    except Exception as e:
        errors.append(str(e))
        
    try:
        res = client.predict(
            param_0=source_image_input,
            param_1=driving_video_input,
            param_2=True,
            param_3=True,
            param_4=True,
            api_name="/gpu_wrapped_execute_video"
        )
        if res: return res
    except Exception as e:
        errors.append(str(e))
        
    raise RuntimeError(f"Gradio API predictions failed: {'; '.join(errors)}")

def main():
    parser = argparse.ArgumentParser(description="LivePortrait animation using KlingTeam Space")
    parser.add_argument("--image", required=True)
    parser.add_argument("--driving-video", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source_image = os.path.abspath(args.image)
    driving_video = os.path.abspath(args.driving_video)
    output_path = os.path.abspath(args.output)
    ffmpeg_path = os.environ.get("FFMPEG_PATH") or "ffmpeg"

    # ── Try Local Offline LivePortrait Inference first! ─────────────────────────
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up to the workspace root: c:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI
    workspace_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    local_lp_dir = os.path.join(workspace_root, 'LivePortrait')
    local_python = os.path.join(local_lp_dir, 'venv', 'Scripts', 'python.exe')
    local_inference = os.path.join(local_lp_dir, 'inference.py')

    if os.path.exists(local_python) and os.path.exists(local_inference):
        print(f"[LivePortrait] Found local offline LivePortrait installation. Running offline inference...")
        local_output_dir = os.path.join(os.path.dirname(output_path), 'lp_temp_out')
        os.makedirs(local_output_dir, exist_ok=True)
        
        # Execute local inference command
        local_cmd = [
            local_python, local_inference,
            "--source", source_image,
            "--driving", driving_video,
            "--output-dir", local_output_dir
        ]
        print(f"[LivePortrait] Running command: {' '.join(local_cmd)}")
        try:
            local_env = os.environ.copy()
            if os.environ.get("FFMPEG_PATH"):
                ffmpeg_dir = os.path.dirname(os.environ.get("FFMPEG_PATH"))
                local_env["PATH"] = ffmpeg_dir + os.pathsep + local_env.get("PATH", "")
                
            res = subprocess.run(local_cmd, cwd=local_lp_dir, env=local_env, capture_output=True, text=True)
            if res.returncode == 0:
                source_base = os.path.splitext(os.path.basename(source_image))[0]
                driving_base = os.path.splitext(os.path.basename(driving_video))[0]
                expected_out_filename = f"{source_base}--{driving_base}.mp4"
                expected_out_path = os.path.join(local_output_dir, expected_out_filename)
                
                if os.path.exists(expected_out_path) and os.path.getsize(expected_out_path) > 0:
                    shutil.copy2(expected_out_path, output_path)
                    print(f"[LivePortrait] Local offline animation succeeded! Output saved to: {output_path}")
                    try: shutil.rmtree(local_output_dir)
                    except: pass
                    sys.exit(0)
                else:
                    print(f"[LivePortrait] Warning: Expected local output file not found at {expected_out_path}. Falling back to Gradio...")
            else:
                print(f"[LivePortrait] Local execution failed with code {res.returncode}. Stderr: {res.stderr}. Falling back to Gradio...")
        except Exception as local_err:
            print(f"[LivePortrait] Exception during local execution: {local_err}. Falling back to Gradio...")

    # ── Fallback to Gradio Client (HuggingFace space) ─────────────────────────
    # Make sure gradio_client is installed
    try:
        from gradio_client import Client
    except ImportError:
        print("[LivePortrait] Installing gradio_client...")
        subprocess.run([sys.executable, "-m", "pip", "install", "gradio_client"], check=True)
        from gradio_client import Client

    print("[LivePortrait] Connecting to innoai/LivePortrait space anonymously...")
    try:
        client = Client("innoai/LivePortrait")
        duration = get_video_duration(driving_video)
        print(f"[LivePortrait] Video duration: {duration:.2f} seconds")
        
        raw_output_temp = output_path + ".raw.mp4"
        
        # If longer than 45 seconds, split into chunks to bypass maximum length constraints
        if duration > 45.0:
            print("[LivePortrait] Splitting video into 5-second chunks...")
            chunks_dir = os.path.join(os.path.dirname(output_path), f"chunks_{int(os.path.getmtime(driving_video))}")
            parts = split_video(driving_video, 5, chunks_dir, ffmpeg_path)
            
            animated_parts = []
            for idx, part in enumerate(parts):
                print(f"[LivePortrait] Animating segment {idx+1}/{len(parts)}")
                pred = animate_single_video(client, source_image, part)
                video_out = pred[0] if isinstance(pred, (list, tuple)) else pred
                if isinstance(video_out, dict):
                    video_out = video_out.get("video") or video_out.get("path")
                if video_out and os.path.exists(video_out):
                    animated_parts.append(video_out)
                else:
                    raise RuntimeError(f"Invalid predict output for segment {idx+1}")
                    
            concatenate_videos(animated_parts, raw_output_temp, ffmpeg_path)
            try: shutil.rmtree(chunks_dir)
            except: pass
        else:
            print("[LivePortrait] Processing video directly...")
            pred = animate_single_video(client, source_image, driving_video)
            video_out = pred[0] if isinstance(pred, (list, tuple)) else pred
            if isinstance(video_out, dict):
                video_out = video_out.get("video") or video_out.get("path")
            if video_out and os.path.exists(video_out):
                shutil.copy2(video_out, raw_output_temp)
            else:
                raise RuntimeError("Invalid predict output path")

        shutil.copy2(raw_output_temp, output_path)
        if os.path.exists(raw_output_temp):
            try: os.remove(raw_output_temp)
            except: pass
            
        print(f"[LivePortrait] Animation succeeded! Saved to: {output_path}")

    except Exception as e:
        print(f"[LivePortrait] Failed: {e}. Falling back to driver video.", file=sys.stderr)
        shutil.copy2(driving_video, output_path)
        sys.exit(1)

if __name__ == "__main__":
    main()
