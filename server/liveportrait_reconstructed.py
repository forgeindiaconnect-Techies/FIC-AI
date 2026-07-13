Created At: 2026-06-30T08:51:33Z
Completed At: 2026-06-30T08:51:33Z
File Path: `file:///c:/Users/Forgeindiaconnect/OneDrive/Documents/My-Projects/AI/forge-ai/server/python/liveportrait_animate.py`
Total Lines: 308
Total Bytes: 12506
Showing lines 1 to 90
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
 # server/python/liveportrait_animate.py
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
         "-c", "copy", out_pattern
     ]
     print(f"[LivePortrait] Splitting video into chunks: {' '.join(cmd)}")
     subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
     
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
     subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
     
     if os.path.exists(temp_list):
         try: os.remove(temp_list)
         except: pass
 
 def enhance_video_faces(input_video_path, output_video_path, ffmpeg_path):
     print(f"[GFPGAN] Enhancing video face clarity: {input_video_path}")
     try:
         import cv2
         import torch
         from gfpgan import GFPGANer
         device = 'cuda' if torch.cuda.is_available() else 'cpu'
         
         # model_path=None will download/load the default GFPGANv1.4.pth
         enhancer = GFPGANer(
             model_path=None, 
             upscale=1, 
             arch='clean', 
             channel_multiplier=2, 
             bg_upsampler=None,
             device=device
         )
     except Exception as init_err:
         print(f"[GFPGAN] Initialization failed: {init_err}. Skipping face enhancement.")
         shutil.copy2(input_video_path, output_video_path)
         return
 
     try:
         cap = cv2.VideoCapture(input_video_path)
         if not cap.isOpened():
             print(f"[GFPGAN] Could not open video: {input_video_path}")
             shutil.copy2(input_video_path, output_video_path)
             return
 
         fps = cap.get(cv2.CAP_PROP_FPS)
         width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
         height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
         total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
 
         temp_out = output_video_path + ".temp_enh.mp4"
         fourcc = cv2.VideoWriter_fourcc(*'mp4v')
         out = cv2.VideoWriter(temp_out, fourcc, fps, (width, height))
 
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
