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
15:  def get_video_duration(video_path):
stage = runtime.stage if runtime else None
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
28:  def split_video(video_path, chunk_duration, output_dir, ffmpeg_path):
29: if __name__ == "__main__":
os.makedirs(output_dir, exist_ok=True)
out_pattern = os.path.join(output_dir, "part_%03d.mp4")
cmd = [
ffmpeg_path, "-y", "-i", video_path, 
"-f", "segment", "-segment_time", str(chunk_duration),
"-c", "copy", out_pattern
]
print(f"[LivePortrait] Splitting video into chunks: {' '.join(cmd)}")
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
39:      parts = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.startswith("part_") and f.endswith(".mp4")])
Returns:
return parts
42:  def concatenate_videos(video_paths, output_path, ffmpeg_path):
* @param {string} params.audioPath - Absolute path to the audio (WAV/MP3).
temp_list = output_path + ".list.txt"
with open(temp_list, "w", encoding="utf-8") as f:
for vp in video_paths:
escaped_path = vp.replace("\\", "/")
f.write(f"file '{escaped_path}'\n")
49:      cmd = [
The above content shows the entire, complete file contents of the requested file.
ffmpeg_path, "-y", "-f", "concat", "-safe", "0", 
"-i", temp_list, "-c", "copy", output_path
]
print(f"[LivePortrait] Concatenating parts: {' '.join(cmd)}")
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
56:      if os.path.exists(temp_list):
try:
try: os.remove(temp_list)
except: pass
60:  def enhance_video_faces(input_video_path, output_video_path, ffmpeg_path):
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"[GFPGAN] Enhancing video face clarity: {input_video_path}")
try:
import cv2
import torch
from gfpgan import GFPGANer
device = 'cuda' if torch.cuda.is_available() else 'cpu'
68:          # model_path=None will download/load the default GFPGANv1.4.pth
bg_upsampler=None,
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
82:      try:
exec(cmd, { env }, (error, stdout, stderr) => {
cap = cv2.VideoCapture(input_video_path)
if not cap.isOpened():
print(f"[GFPGAN] Could not open video: {input_video_path}")
shutil.copy2(input_video_path, output_video_path)
return
89:          fps = cap.get(cv2.CAP_PROP_FPS)
resolve();
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
94:          temp_out = output_video_path + ".temp_enh.mp4"
await new Promise((resolve) => {
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(temp_out, fourcc, fps, (width, height))
98: The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
if (error) {
The above content shows the entire, complete file contents of the requested file.
logDiagnosticError('LivePortrait Inference', cmd, error, stdout, stderr);
// fallback: just copy lipSyncPath
fs.copyFileSync(lipSyncPath, motionPath);
} else {
console.log('LivePortrait completed:', stdout);
}
resolve();
});
});
110:   // 3️⃣ Combine with FFmpeg (ensure audio is present and video is encoded as MP4)
111:   // 3️⃣ Combine with FFmpeg (ensure audio is present and video is encoded as MP4)
await new Promise((resolve, reject) => {
const cmd = `ffmpeg -y -i "${motionPath}" -i "${audioPath}" -c:v libx264 -c:a aac -shortest "${finalVideoPath}"`;
exec(cmd, { env }, (error, stdout, stderr) => {
if (error) {
console.error('FFmpeg combine error:', stderr || error.message);
console.error('FFmpeg combine error:', stderr || error.message);
logDiagnosticError('FFmpeg Combine', cmd, error, stdout, stderr);
return reject(error);
}
121:         cap.release()
resolve();
out.release()
124:         # Verify that temp_out is created and not empty
125:   return finalVideoPath;
if os.path.exists(temp_out) and os.path.getsize(temp_out) > 0:
# Merge original audio from input_video_path to temp_out using ffmpeg
print("[GFPGAN] Merging original audio back...")
merge_cmd = [
ffmpeg_path, "-y", "-i", temp_out, "-i", input_video_path,
"-map", "0:v:0", "-map", "1:a:0?", "-c:v", "copy", "-c:a", "aac", "-shortest", output_video_path
]
subprocess.run(merge_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
134:             if os.path.exists(temp_out):
shutil.copy2(input_video_path, output_video_path)
try: os.remove(temp_out)
except: pass
138:             print(f"[GFPGAN] Finished face enhancement! Saved to {output_video_path}")
139: def animate_single_video(client, source_image, video_path):
else:
print("[GFPGAN] Output video is empty or missing. Skipping face enhancement.")
shutil.copy2(input_video_path, output_video_path)
except Exception as e:
print(f"[GFPGAN] Enhancement failed with exception: {e}. Falling back.")
shutil.copy2(input_video_path, output_video_path)
146: def animate_single_video(client, source_image, video_path):
def animate_single_video(client, source_image, video_path):
from gradio_client import handle_file
source_image_input = handle_file(source_image)
driving_video_input = {
"video": handle_file(video_path),
"subtitles": None
}
154:     errors = []
param_2=True,
# Attempt 1: Named API parameters for /gpu_wrapped_execute_video
try:
result = client.predict(
param_0=source_image_input,
param_1=driving_video_input,
param_2=True,
param_3=True,
param_4=True,
api_name="/gpu_wrapped_execute_video"
)
if result:
return result
except Exception as e1:
errors.append(f"Attempt 1 (/gpu_wrapped_execute_video named) failed: {e1}")
170:     # Attempt 2: Positional arguments for /gpu_wrapped_execute_video
True,
try:
result = client.predict(
source_image_input,
driving_video_input,
True,
True,
True,
api_name="/gpu_wrapped_execute_video"
)
if result:
return result
except Exception as e2:
errors.append(f"Attempt 2 (/gpu_wrapped_execute_video positional) failed: {e2}")
185:     # Attempt 3: Default call without api_name
if result:
try:
result = client.predict(
source_image_input,
driving_video_input
)
if result:
return result
except Exception as e3:
errors.append(f"Attempt 3 (default call) failed: {e3}")
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
parser.add_argument("--output", required=True, help="Path to write final video")
args = parser.parse_args()
199:     source_image = os.path.abspath(args.image)
driving_video = os.path.abspath(args.driving_video)
driving_video = os.path.abspath(args.driving_video)
output_path = os.path.abspath(args.output)
ffmpeg_path = os.environ.get("FFMPEG_PATH") or "ffmpeg"
204:     print(f"[LivePortrait] Attempting face animation. Source: {source_image}, Driver: {driving_video}")
205:     # Check for Hugging Face Token in environment
206:     # Check for Hugging Face Token in environment
hf_token = os.environ.get("HF_API_KEY")
hf_token = os.environ.get("HF_API_KEY")
if not hf_token:
print("[LivePortrait] HF_API_KEY environment variable not found. Exiting with failure so Node logs details.", file=sys.stderr)
shutil.copy2(driving_video, output_path)
sys.exit(1)
213:     try:
from gradio_client import Client, handle_file
from gradio_client import Client, handle_file
except ImportError:
print("[LivePortrait] gradio_client not found. Attempting to auto-install...")
import subprocess
try:
subprocess.run([sys.executable, "-m", "pip", "install", "gradio_client"], check=True)
from gradio_client import Client, handle_file
print("[LivePortrait] gradio_client successfully installed!")
except Exception as inst_err:
print(f"[LivePortrait] Auto-install failed: {inst_err}. Copying driving video.", file=sys.stderr)
shutil.copy2(driving_video, output_path)
sys.exit(1)
227:     try:
print("[LivePortrait] Connecting to KlingTeam/LivePortrait space...")
print("[LivePortrait] Connecting to KlingTeam/LivePortrait space...")
# Handle different gradio_client version token parameter names
try:
client = Client("KlingTeam/LivePortrait", token=hf_token)
except TypeError:
try:
client = Client("KlingTeam/LivePortrait", hf_token=hf_token)
except TypeError:
client = Client("KlingTeam/LivePortrait")
238:         # Write endpoints to debug log file
try:
try:
api_info = client.view_api(return_format="str")
with open("liveportrait_debug.txt", "w", encoding="utf-8") as f:
f.write(api_info)
print("[LivePortrait] Successfully wrote endpoints to liveportrait_debug.txt")
except Exception as deb_err:
print(f"[LivePortrait] Failed to write debug endpoints: {deb_err}")
247:         # Check video duration to see if we need to split it
duration = get_video_duration(driving_video)
duration = get_video_duration(driving_video)
print(f"[LivePortrait] Input video duration: {duration:.2f} seconds")
251:         animated_video_temp = output_path + ".animated_raw.mp4"
252:         if duration > 6.0:
253:         if duration > 6.0:
print(f"[LivePortrait] Video duration ({duration:.2f}s) is long. Splitting into 5-second chunks...")
print(f"[LivePortrait] Video duration ({duration:.2f}s) is long. Splitting into 5-second chunks...")
# Create a unique temp folder for chunks
chunks_dir = os.path.join(os.path.dirname(output_path), f"chunks_{int(os.path.getmtime(driving_video))}")
parts = split_video(driving_video, 5, chunks_dir, ffmpeg_path)
259:             animated_parts = []
for idx, part in enumerate(parts):
for idx, part in enumerate(parts):
print(f"[LivePortrait] Animating segment {idx+1}/{len(parts)}: {part}")
pred_result = animate_single_video(client, source_image, part)
264:                 # Parse return output
video_output = pred_result[0] if isinstance(pred_result, (tuple, list)) else pred_result
video_output = pred_result[0] if isinstance(pred_result, (tuple, list)) else pred_result
if isinstance(video_output, dict):
video_output = video_output.get("video") or video_output.get("path")
269:                 if video_output and isinstance(video_output, str) and os.path.exists(video_output):
animated_parts.append(video_output)
animated_parts.append(video_output)
else:
raise RuntimeError(f"Expected valid file path for segment {idx+1} but got: {pred_result}")
274:             # Concatenate all animated segments
concatenate_videos(animated_parts, animated_video_temp, ffmpeg_path)
concatenate_videos(animated_parts, animated_video_temp, ffmpeg_path)
277:             # Clean up chunks folder
try: shutil.rmtree(chunks_dir)
try: shutil.rmtree(chunks_dir)
except: pass
else:
print("[LivePortrait] Processing video directly...")
pred_result = animate_single_video(client, source_image, driving_video)
video_output = pred_result[0] if isinstance(pred_result, (tuple, list)) else pred_result
if isinstance(video_output, dict):
video_output = video_output.get("video") or video_output.get("path")
287:             if video_output and isinstance(video_output, str) and os.path.exists(video_output):
shutil.copy2(video_output, animated_video_temp)
shutil.copy2(video_output, animated_video_temp)
else:
raise RuntimeError(f"Expected valid file output path but got: {pred_result}")
292:         # Run face enhancement on the final animated video using GFPGAN
enhance_video_faces(animated_video_temp, output_path, ffmpeg_path)
enhance_video_faces(animated_video_temp, output_path, ffmpeg_path)
295:         # Clean up temp raw video
if os.path.exists(animated_video_temp):
if os.path.exists(animated_video_temp):
try: os.remove(animated_video_temp)
except: pass
300:         print(f"[LivePortrait] Animation & GFPGAN enhancement succeeded! Saved to: {output_path}")
301:     except Exception as e:
302:     except Exception as e:
print(f"[LivePortrait] Gradio API call failed: {e}. Falling back to original Wav2Lip video.", file=sys.stderr)
print(f"[LivePortrait] Gradio API call failed: {e}. Falling back to original Wav2Lip video.", file=sys.stderr)
shutil.copy2(driving_video, output_path)
sys.exit(1)
307: if __name__ == "__main__":
main()
main()
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
# MISSING LINE 310
# MISSING LINE 311
# MISSING LINE 312
# MISSING LINE 313
# MISSING LINE 314
# MISSING LINE 315
# MISSING LINE 316
# MISSING LINE 317
# MISSING LINE 318
# MISSING LINE 319
# MISSING LINE 320
# MISSING LINE 321
# MISSING LINE 322
# MISSING LINE 323
# MISSING LINE 324
# MISSING LINE 325
# MISSING LINE 326
# MISSING LINE 327
# MISSING LINE 328
# MISSING LINE 329
# MISSING LINE 330
# MISSING LINE 331
# MISSING LINE 332
# MISSING LINE 333
# MISSING LINE 334
# MISSING LINE 335
# MISSING LINE 336
# MISSING LINE 337
# MISSING LINE 338
# MISSING LINE 339
# MISSING LINE 340
# MISSING LINE 341
# MISSING LINE 342
# MISSING LINE 343
# MISSING LINE 344
# MISSING LINE 345
# MISSING LINE 346
# MISSING LINE 347
# MISSING LINE 348
# MISSING LINE 349
# MISSING LINE 350
# MISSING LINE 351
# MISSING LINE 352
# MISSING LINE 353
# MISSING LINE 354
# MISSING LINE 355
# MISSING LINE 356
# MISSING LINE 357
# MISSING LINE 358
# MISSING LINE 359
# MISSING LINE 360
# MISSING LINE 361
# MISSING LINE 362
# MISSING LINE 363
# MISSING LINE 364
# MISSING LINE 365
# MISSING LINE 366
# MISSING LINE 367
# MISSING LINE 368
# MISSING LINE 369
# MISSING LINE 370
# MISSING LINE 371
# MISSING LINE 372
# MISSING LINE 373
# MISSING LINE 374
# MISSING LINE 375
# MISSING LINE 376
# MISSING LINE 377
# MISSING LINE 378
# MISSING LINE 379
# MISSING LINE 380
# MISSING LINE 381
# MISSING LINE 382
# MISSING LINE 383
# MISSING LINE 384
# MISSING LINE 385
# MISSING LINE 386
# MISSING LINE 387
# MISSING LINE 388
# MISSING LINE 389
# MISSING LINE 390
# MISSING LINE 391
# MISSING LINE 392
# MISSING LINE 393
# MISSING LINE 394
# MISSING LINE 395
# MISSING LINE 396
# MISSING LINE 397
# MISSING LINE 398
# MISSING LINE 399
# MISSING LINE 400
# MISSING LINE 401
# MISSING LINE 402
# MISSING LINE 403
# MISSING LINE 404
# MISSING LINE 405
# MISSING LINE 406
# MISSING LINE 407
# MISSING LINE 408
# MISSING LINE 409
# MISSING LINE 410
# MISSING LINE 411
# MISSING LINE 412
# MISSING LINE 413
# MISSING LINE 414
# MISSING LINE 415
# MISSING LINE 416
# MISSING LINE 417
# MISSING LINE 418
# MISSING LINE 419
# MISSING LINE 420
# MISSING LINE 421
# MISSING LINE 422
# MISSING LINE 423
# MISSING LINE 424
# MISSING LINE 425
# MISSING LINE 426
# MISSING LINE 427
# MISSING LINE 428
# MISSING LINE 429
# MISSING LINE 430
# MISSING LINE 431
# MISSING LINE 432
# MISSING LINE 433
# MISSING LINE 434
# MISSING LINE 435
# MISSING LINE 436
# MISSING LINE 437
# MISSING LINE 438
# MISSING LINE 439
# MISSING LINE 440
# MISSING LINE 441
# MISSING LINE 442
# MISSING LINE 443
# MISSING LINE 444
# MISSING LINE 445
# MISSING LINE 446
# MISSING LINE 447
# MISSING LINE 448
# MISSING LINE 449
# MISSING LINE 450
# MISSING LINE 451
# MISSING LINE 452
# MISSING LINE 453
# MISSING LINE 454
# MISSING LINE 455
# MISSING LINE 456
# MISSING LINE 457
# MISSING LINE 458
# MISSING LINE 459
fmin=hp.fmin, fmax=hp.fmax)
^^^^^^^^^^^^^^^^^^^^^^^^^^^
TypeError: mel() takes 0 positional arguments but 2 positional arguments (and 3 keyword-only arguments) were given
464: 
# MISSING LINE 464
========================================
467: ========================================
# MISSING LINE 467
[2026-06-29T11:48:02.761Z] ERROR IN STEP: LivePortrait Inference
Command run: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782733609343\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782733609343\motion.mp4"
Error Message: Command failed: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782733609343\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782733609343\motion.mp4"
[LivePortrait] Gradio API call failed: Client.__init__() got an unexpected keyword argument 'hf_token'. Falling back to original Wav2Lip video.
473: --- STDOUT ---
# MISSING LINE 473
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782733609343\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
477: --- STDERR ---
# MISSING LINE 477
[LivePortrait] Gradio API call failed: Client.__init__() got an unexpected keyword argument 'hf_token'. Falling back to original Wav2Lip video.
480: ========================================
# MISSING LINE 480
482: ========================================
# MISSING LINE 482
[2026-06-29T12:23:20.727Z] ERROR IN STEP: LivePortrait Inference
Command run: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782735632833\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782735632833\motion.mp4"
Error Message: Command failed: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782735632833\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782735632833\motion.mp4"
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/animate with keywords) failed: Cannot find a function with `api_name`: /animate.; Attempt 2 (/animate positional) failed: Cannot find a function with `api_name`: /animate.; Attempt 3 (/predict with keywords) failed: Cannot find a function with `api_name`: /predict.; Attempt 4 (/predict positional) failed: Cannot find a function with `api_name`: /predict.; Attempt 5 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
488: --- STDOUT ---
# MISSING LINE 488
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782735632833\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
Loaded as API: https://klingteam-liveportrait.hf.space
[LivePortrait] Failed to write debug endpoints: 'int' object has no attribute 'api_name'
[LivePortrait] Sending prediction request...
495: --- STDERR ---
# MISSING LINE 495
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/animate with keywords) failed: Cannot find a function with `api_name`: /animate.; Attempt 2 (/animate positional) failed: Cannot find a function with `api_name`: /animate.; Attempt 3 (/predict with keywords) failed: Cannot find a function with `api_name`: /predict.; Attempt 4 (/predict positional) failed: Cannot find a function with `api_name`: /predict.; Attempt 5 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
498: ========================================
# MISSING LINE 498
500: ========================================
# MISSING LINE 500
[2026-06-29T12:35:18.579Z] ERROR IN STEP: LivePortrait Inference
Command run: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736382641\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736382641\motion.mp4"
Error Message: Command failed: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736382641\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736382641\motion.mp4"
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/animate with keywords) failed: Cannot find a function with `api_name`: /animate.; Attempt 2 (/animate positional) failed: Cannot find a function with `api_name`: /animate.; Attempt 3 (/predict with keywords) failed: Cannot find a function with `api_name`: /predict.; Attempt 4 (/predict positional) failed: Cannot find a function with `api_name`: /predict.; Attempt 5 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
506: --- STDOUT ---
# MISSING LINE 506
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736382641\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
Loaded as API: https://klingteam-liveportrait.hf.space
Client.predict() Usage Info
---------------------------
Named API endpoints: 3
514:  - predict(param_0, param_1, param_2, param_3, api_name="/gpu_wrapped_execute_image") -> (value_3, value_4)
# MISSING LINE 514
Parameters:
- [Slider] param_0: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Slider] param_1: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Image] param_2: filepath (required)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
Returns:
- [Image] value_3: filepath 
- [Image] value_4: filepath 
524:  - predict(param_0, param_1, param_2, param_3, param_4, api_name="/gpu_wrapped_execute_video") -> (value_5, value_6)
# MISSING LINE 524
Parameters:
- [Image] param_0: filepath (required)  
- [Video] param_1: Dict(video: filepath, subtitles: filepath | None) (required)  
- [Checkbox] param_2: bool (not required, defaults to:   True)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
- [Checkbox] param_4: bool (not required, defaults to:   True)  
Returns:
- [Video] value_5: Dict(video: filepath, subtitles: filepath | None) 
- [Video] value_6: Dict(video: filepath, subtitles: filepath | None) 
535:  - predict(video_path, api_name="/is_square_video") -> value_15
# MISSING LINE 535
Parameters:
- [Video] video_path: Dict(video: filepath, subtitles: filepath | None) (required)  
Returns:
- [Video] value_15: Dict(video: filepath, subtitles: filepath | None) 
541: [LivePortrait] Successfully wrote endpoints to liveportrait_debug.txt
# MISSING LINE 541
[LivePortrait] Sending prediction request...
544: --- STDERR ---
# MISSING LINE 544
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/animate with keywords) failed: Cannot find a function with `api_name`: /animate.; Attempt 2 (/animate positional) failed: Cannot find a function with `api_name`: /animate.; Attempt 3 (/predict with keywords) failed: Cannot find a function with `api_name`: /predict.; Attempt 4 (/predict positional) failed: Cannot find a function with `api_name`: /predict.; Attempt 5 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
547: ========================================
# MISSING LINE 547
549: ========================================
# MISSING LINE 549
[2026-06-29T12:45:04.218Z] ERROR IN STEP: LivePortrait Inference
Command run: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736853771\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736853771\motion.mp4"
Error Message: Command failed: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736853771\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736853771\motion.mp4"
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: The upstream Gradio app has raised an exception but has not enabled verbose error reporting. To enable, set show_error=True in launch().; Attempt 2 (/gpu_wrapped_execute_video positional) failed: The upstream Gradio app has raised an exception but has not enabled verbose error reporting. To enable, set show_error=True in launch().; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
555: --- STDOUT ---
# MISSING LINE 555
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782736853771\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
Loaded as API: https://klingteam-liveportrait.hf.space
Client.predict() Usage Info
---------------------------
Named API endpoints: 3
563:  - predict(param_0, param_1, param_2, param_3, api_name="/gpu_wrapped_execute_image") -> (value_3, value_4)
# MISSING LINE 563
Parameters:
- [Slider] param_0: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Slider] param_1: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Image] param_2: filepath (required)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
Returns:
- [Image] value_3: filepath 
- [Image] value_4: filepath 
573:  - predict(param_0, param_1, param_2, param_3, param_4, api_name="/gpu_wrapped_execute_video") -> (value_5, value_6)
# MISSING LINE 573
Parameters:
- [Image] param_0: filepath (required)  
- [Video] param_1: Dict(video: filepath, subtitles: filepath | None) (required)  
- [Checkbox] param_2: bool (not required, defaults to:   True)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
- [Checkbox] param_4: bool (not required, defaults to:   True)  
Returns:
- [Video] value_5: Dict(video: filepath, subtitles: filepath | None) 
- [Video] value_6: Dict(video: filepath, subtitles: filepath | None) 
584:  - predict(video_path, api_name="/is_square_video") -> value_15
# MISSING LINE 584
Parameters:
- [Video] video_path: Dict(video: filepath, subtitles: filepath | None) (required)  
Returns:
- [Video] value_15: Dict(video: filepath, subtitles: filepath | None) 
590: [LivePortrait] Successfully wrote endpoints to liveportrait_debug.txt
# MISSING LINE 590
[LivePortrait] Sending prediction request...
593: --- STDERR ---
# MISSING LINE 593
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: The upstream Gradio app has raised an exception but has not enabled verbose error reporting. To enable, set show_error=True in launch().; Attempt 2 (/gpu_wrapped_execute_video positional) failed: The upstream Gradio app has raised an exception but has not enabled verbose error reporting. To enable, set show_error=True in launch().; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
596: ========================================
# MISSING LINE 596
598: ========================================
# MISSING LINE 598
[2026-06-29T12:55:12.023Z] ERROR IN STEP: LivePortrait Inference
Command run: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782737480504\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782737480504\motion.mp4"
Error Message: Command failed: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782737480504\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782737480504\motion.mp4"
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
604: --- STDOUT ---
# MISSING LINE 604
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782737480504\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
Loaded as API: https://klingteam-liveportrait.hf.space
Client.predict() Usage Info
---------------------------
Named API endpoints: 3
612:  - predict(param_0, param_1, param_2, param_3, api_name="/gpu_wrapped_execute_image") -> (value_3, value_4)
# MISSING LINE 612
Parameters:
- [Slider] param_0: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Slider] param_1: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Image] param_2: filepath (required)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
Returns:
- [Image] value_3: filepath 
- [Image] value_4: filepath 
622:  - predict(param_0, param_1, param_2, param_3, param_4, api_name="/gpu_wrapped_execute_video") -> (value_5, value_6)
# MISSING LINE 622
Parameters:
- [Image] param_0: filepath (required)  
- [Video] param_1: Dict(video: filepath, subtitles: filepath | None) (required)  
- [Checkbox] param_2: bool (not required, defaults to:   True)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
- [Checkbox] param_4: bool (not required, defaults to:   True)  
Returns:
- [Video] value_5: Dict(video: filepath, subtitles: filepath | None) 
- [Video] value_6: Dict(video: filepath, subtitles: filepath | None) 
633:  - predict(video_path, api_name="/is_square_video") -> value_15
# MISSING LINE 633
Parameters:
- [Video] video_path: Dict(video: filepath, subtitles: filepath | None) (required)  
Returns:
- [Video] value_15: Dict(video: filepath, subtitles: filepath | None) 
639: [LivePortrait] Successfully wrote endpoints to liveportrait_debug.txt
# MISSING LINE 639
[LivePortrait] Sending prediction request...
642: --- STDERR ---
# MISSING LINE 642
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
645: ========================================
# MISSING LINE 645
647: ========================================
# MISSING LINE 647
[2026-06-30T05:11:42.906Z] ERROR IN STEP: LivePortrait Inference
Command run: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\uploads\video\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782796168093\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782796168093\motion.mp4"
Error Message: Command failed: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\uploads\video\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782796168093\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782796168093\motion.mp4"
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: _ssl.c:1063: The handshake operation timed out; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
653: --- STDOUT ---
# MISSING LINE 653
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\uploads\video\enhanced.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782796168093\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
Loaded as API: https://klingteam-liveportrait.hf.space
Client.predict() Usage Info
---------------------------
Named API endpoints: 3
661:  - predict(param_0, param_1, param_2, param_3, api_name="/gpu_wrapped_execute_image") -> (value_3, value_4)
# MISSING LINE 661
Parameters:
- [Slider] param_0: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Slider] param_1: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Image] param_2: filepath (required)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
Returns:
- [Image] value_3: filepath 
- [Image] value_4: filepath 
671:  - predict(param_0, param_1, param_2, param_3, param_4, api_name="/gpu_wrapped_execute_video") -> (value_5, value_6)
# MISSING LINE 671
Parameters:
- [Image] param_0: filepath (required)  
- [Video] param_1: Dict(video: filepath, subtitles: filepath | None) (required)  
- [Checkbox] param_2: bool (not required, defaults to:   True)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
- [Checkbox] param_4: bool (not required, defaults to:   True)  
Returns:
- [Video] value_5: Dict(video: filepath, subtitles: filepath | None) 
- [Video] value_6: Dict(video: filepath, subtitles: filepath | None) 
682:  - predict(video_path, api_name="/is_square_video") -> value_15
# MISSING LINE 682
Parameters:
- [Video] video_path: Dict(video: filepath, subtitles: filepath | None) (required)  
Returns:
- [Video] value_15: Dict(video: filepath, subtitles: filepath | None) 
688: [LivePortrait] Successfully wrote endpoints to liveportrait_debug.txt
# MISSING LINE 688
[LivePortrait] Sending prediction request...
691: --- STDERR ---
# MISSING LINE 691
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: _ssl.c:1063: The handshake operation timed out; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
694: ========================================
# MISSING LINE 694
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
# MISSING LINE 696
# MISSING LINE 697
# MISSING LINE 698
# MISSING LINE 699
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
702: --- STDOUT ---
# MISSING LINE 702
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782808599229\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
Loaded as API: https://klingteam-liveportrait.hf.space
Client.predict() Usage Info
---------------------------
Named API endpoints: 3
710:  - predict(param_0, param_1, param_2, param_3, api_name="/gpu_wrapped_execute_image") -> (value_3, value_4)
# MISSING LINE 710
Parameters:
- [Slider] param_0: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Slider] param_1: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Image] param_2: filepath (required)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
Returns:
- [Image] value_3: filepath 
- [Image] value_4: filepath 
720:  - predict(param_0, param_1, param_2, param_3, param_4, api_name="/gpu_wrapped_execute_video") -> (value_5, value_6)
# MISSING LINE 720
Parameters:
- [Image] param_0: filepath (required)  
- [Video] param_1: Dict(video: filepath, subtitles: filepath | None) (required)  
- [Checkbox] param_2: bool (not required, defaults to:   True)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
- [Checkbox] param_4: bool (not required, defaults to:   True)  
Returns:
- [Video] value_5: Dict(video: filepath, subtitles: filepath | None) 
- [Video] value_6: Dict(video: filepath, subtitles: filepath | None) 
731:  - predict(video_path, api_name="/is_square_video") -> value_15
# MISSING LINE 731
Parameters:
- [Video] video_path: Dict(video: filepath, subtitles: filepath | None) (required)  
Returns:
- [Video] value_15: Dict(video: filepath, subtitles: filepath | None) 
737: [LivePortrait] Successfully wrote endpoints to liveportrait_debug.txt
# MISSING LINE 737
[LivePortrait] Input video duration: 38.68 seconds
[LivePortrait] Video duration (38.68s) is long. Splitting into 5-second chunks...
[LivePortrait] Splitting video into chunks: C:/Users/Forgeindiaconnect/ffmpeg/ffmpeg.exe -y -i C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782808599229\lipsync.mp4 -f segment -segment_time 5 -c copy C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782808599229\chunks_1782808687\part_%03d.mp4
[LivePortrait] Animating segment 1/4: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782808599229\chunks_1782808687\part_000.mp4
743: --- STDERR ---
# MISSING LINE 743
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
746: ========================================
# MISSING LINE 746
748: ========================================
# MISSING LINE 748
[2026-06-30T09:07:08.471Z] ERROR IN STEP: LivePortrait Inference
Command run: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\uploads\video\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782810341830\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782810341830\motion.mp4"
Error Message: Command failed: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\uploads\video\enhanced.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782810341830\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782810341830\motion.mp4"
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
754: --- STDOUT ---
# MISSING LINE 754
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\uploads\video\enhanced.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782810341830\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
Loaded as API: https://klingteam-liveportrait.hf.space
Client.predict() Usage Info
---------------------------
Named API endpoints: 3
762:  - predict(param_0, param_1, param_2, param_3, api_name="/gpu_wrapped_execute_image") -> (value_3, value_4)
# MISSING LINE 762
Parameters:
- [Slider] param_0: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Slider] param_1: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Image] param_2: filepath (required)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
Returns:
- [Image] value_3: filepath 
- [Image] value_4: filepath 
772:  - predict(param_0, param_1, param_2, param_3, param_4, api_name="/gpu_wrapped_execute_video") -> (value_5, value_6)
# MISSING LINE 772
Parameters:
- [Image] param_0: filepath (required)  
- [Video] param_1: Dict(video: filepath, subtitles: filepath | None) (required)  
- [Checkbox] param_2: bool (not required, defaults to:   True)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
- [Checkbox] param_4: bool (not required, defaults to:   True)  
Returns:
- [Video] value_5: Dict(video: filepath, subtitles: filepath | None) 
- [Video] value_6: Dict(video: filepath, subtitles: filepath | None) 
783:  - predict(video_path, api_name="/is_square_video") -> value_15
# MISSING LINE 783
Parameters:
- [Video] video_path: Dict(video: filepath, subtitles: filepath | None) (required)  
Returns:
- [Video] value_15: Dict(video: filepath, subtitles: filepath | None) 
789: [LivePortrait] Successfully wrote endpoints to liveportrait_debug.txt
# MISSING LINE 789
[LivePortrait] Input video duration: 23.76 seconds
[LivePortrait] Video duration (23.76s) is long. Splitting into 5-second chunks...
[LivePortrait] Splitting video into chunks: C:/Users/Forgeindiaconnect/ffmpeg/ffmpeg.exe -y -i C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782810341830\lipsync.mp4 -f segment -segment_time 5 -c copy C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782810341830\chunks_1782810401\part_%03d.mp4
[LivePortrait] Animating segment 1/3: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782810341830\chunks_1782810401\part_000.mp4
795: --- STDERR ---
# MISSING LINE 795
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
798: ========================================
# MISSING LINE 798
800: ========================================
# MISSING LINE 800
[2026-06-30T09:56:36.752Z] ERROR IN STEP: LivePortrait Inference
Command run: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced_doc_img_1782813188295.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782813201717\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782813201717\motion.mp4"
Error Message: Command failed: "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\venv\Scripts\python.exe" "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\python\liveportrait_animate.py" --image "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced_doc_img_1782813188295.jpg" --driving-video "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782813201717\lipsync.mp4" --output "C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782813201717\motion.mp4"
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
806: --- STDOUT ---
# MISSING LINE 806
[LivePortrait] Attempting face animation. Source: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\enhanced_doc_img_1782813188295.jpg, Driver: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782813201717\lipsync.mp4
[LivePortrait] Connecting to KlingTeam/LivePortrait space...
Loaded as API: https://klingteam-liveportrait.hf.space
Client.predict() Usage Info
---------------------------
Named API endpoints: 3
814:  - predict(param_0, param_1, param_2, param_3, api_name="/gpu_wrapped_execute_image") -> (value_3, value_4)
# MISSING LINE 814
Parameters:
- [Slider] param_0: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Slider] param_1: float (not required, defaults to:   0)  (numeric value between 0 and 0.8) 
- [Image] param_2: filepath (required)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
Returns:
- [Image] value_3: filepath 
- [Image] value_4: filepath 
824:  - predict(param_0, param_1, param_2, param_3, param_4, api_name="/gpu_wrapped_execute_video") -> (value_5, value_6)
# MISSING LINE 824
Parameters:
- [Image] param_0: filepath (required)  
- [Video] param_1: Dict(video: filepath, subtitles: filepath | None) (required)  
- [Checkbox] param_2: bool (not required, defaults to:   True)  
- [Checkbox] param_3: bool (not required, defaults to:   True)  
- [Checkbox] param_4: bool (not required, defaults to:   True)  
Returns:
- [Video] value_5: Dict(video: filepath, subtitles: filepath | None) 
- [Video] value_6: Dict(video: filepath, subtitles: filepath | None) 
835:  - predict(video_path, api_name="/is_square_video") -> value_15
# MISSING LINE 835
Parameters:
- [Video] video_path: Dict(video: filepath, subtitles: filepath | None) (required)  
Returns:
- [Video] value_15: Dict(video: filepath, subtitles: filepath | None) 
841: [LivePortrait] Successfully wrote endpoints to liveportrait_debug.txt
# MISSING LINE 841
[LivePortrait] Input video duration: 45.64 seconds
[LivePortrait] Video duration (45.64s) is long. Splitting into 5-second chunks...
[LivePortrait] Splitting video into chunks: C:/Users/Forgeindiaconnect/ffmpeg/ffmpeg.exe -y -i C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782813201717\lipsync.mp4 -f segment -segment_time 5 -c copy C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782813201717\chunks_1782813363\part_%03d.mp4
[LivePortrait] Animating segment 1/5: C:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\tmp\wav2lip_1782813201717\chunks_1782813363\part_000.mp4
847: --- STDERR ---
# MISSING LINE 847
[LivePortrait] Gradio API call failed: All prediction attempts failed. Errors: Attempt 1 (/gpu_wrapped_execute_video named) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 2 (/gpu_wrapped_execute_video positional) failed: 'The requested GPU duration (240s) is larger than the maximum allowed'; Attempt 3 (default call) failed: This Gradio app might have multiple endpoints. Please specify an `api_name` or `fn_index`. Falling back to original Wav2Lip video.
850: ========================================
# MISSING LINE 850
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
# MISSING LINE 852
# MISSING LINE 853
# MISSING LINE 854
# MISSING LINE 855
# MISSING LINE 856
# MISSING LINE 857
# MISSING LINE 858
# MISSING LINE 859
# MISSING LINE 860
# MISSING LINE 861
# MISSING LINE 862
# MISSING LINE 863
# MISSING LINE 864
# MISSING LINE 865
# MISSING LINE 866
# MISSING LINE 867
# MISSING LINE 868
# MISSING LINE 869
# MISSING LINE 870
# MISSING LINE 871
# MISSING LINE 872
# MISSING LINE 873
# MISSING LINE 874
# MISSING LINE 875
# MISSING LINE 876
# MISSING LINE 877
# MISSING LINE 878
# MISSING LINE 879
# MISSING LINE 880
# MISSING LINE 881
# MISSING LINE 882
# MISSING LINE 883
# MISSING LINE 884
# MISSING LINE 885
# MISSING LINE 886
# MISSING LINE 887
# MISSING LINE 888
# MISSING LINE 889
# MISSING LINE 890
# MISSING LINE 891
# MISSING LINE 892
# MISSING LINE 893
# MISSING LINE 894
# MISSING LINE 895
# MISSING LINE 896
# MISSING LINE 897
# MISSING LINE 898
# MISSING LINE 899
# MISSING LINE 900
# MISSING LINE 901
# MISSING LINE 902
# MISSING LINE 903
# MISSING LINE 904
# MISSING LINE 905
# MISSING LINE 906
# MISSING LINE 907
# MISSING LINE 908
# MISSING LINE 909
# MISSING LINE 910
# MISSING LINE 911
# MISSING LINE 912
# MISSING LINE 913
# MISSING LINE 914
# MISSING LINE 915
# MISSING LINE 916
# MISSING LINE 917
# MISSING LINE 918
# MISSING LINE 919
# MISSING LINE 920
# MISSING LINE 921
# MISSING LINE 922
# MISSING LINE 923
# MISSING LINE 924
# MISSING LINE 925
# MISSING LINE 926
# MISSING LINE 927
# MISSING LINE 928
# MISSING LINE 929
# MISSING LINE 930
# MISSING LINE 931
# MISSING LINE 932
# MISSING LINE 933
# MISSING LINE 934
# MISSING LINE 935
# MISSING LINE 936
# MISSING LINE 937
# MISSING LINE 938
# MISSING LINE 939
# MISSING LINE 940
# MISSING LINE 941
# MISSING LINE 942
# MISSING LINE 943
# MISSING LINE 944
# MISSING LINE 945
# MISSING LINE 946
# MISSING LINE 947
# MISSING LINE 948
# MISSING LINE 949
# MISSING LINE 950
# MISSING LINE 951
# MISSING LINE 952
# MISSING LINE 953
# MISSING LINE 954
# MISSING LINE 955
# MISSING LINE 956
# MISSING LINE 957
# MISSING LINE 958
# MISSING LINE 959
# MISSING LINE 960
# MISSING LINE 961
# MISSING LINE 962
# MISSING LINE 963
# MISSING LINE 964
# MISSING LINE 965
# MISSING LINE 966
# MISSING LINE 967
# MISSING LINE 968
# MISSING LINE 969
# MISSING LINE 970
# MISSING LINE 971
# MISSING LINE 972
# MISSING LINE 973
# MISSING LINE 974
# MISSING LINE 975
# MISSING LINE 976
# MISSING LINE 977
# MISSING LINE 978
# MISSING LINE 979
# MISSING LINE 980
# MISSING LINE 981
# MISSING LINE 982
# MISSING LINE 983
# MISSING LINE 984
# MISSING LINE 985
# MISSING LINE 986
# MISSING LINE 987
# MISSING LINE 988
# MISSING LINE 989
# MISSING LINE 990
# MISSING LINE 991
# MISSING LINE 992
# MISSING LINE 993
# MISSING LINE 994
# MISSING LINE 995
# MISSING LINE 996
# MISSING LINE 997
# MISSING LINE 998
# MISSING LINE 999
# MISSING LINE 1000
# MISSING LINE 1001
# MISSING LINE 1002
# MISSING LINE 1003
# MISSING LINE 1004
# MISSING LINE 1005
# MISSING LINE 1006
# MISSING LINE 1007
# MISSING LINE 1008
# MISSING LINE 1009
# MISSING LINE 1010
# MISSING LINE 1011
# MISSING LINE 1012
# MISSING LINE 1013
# MISSING LINE 1014
# MISSING LINE 1015
# MISSING LINE 1016
# MISSING LINE 1017
# MISSING LINE 1018
# MISSING LINE 1019
# MISSING LINE 1020
# MISSING LINE 1021
# MISSING LINE 1022
# MISSING LINE 1023
# MISSING LINE 1024
# MISSING LINE 1025
# MISSING LINE 1026
# MISSING LINE 1027
# MISSING LINE 1028
# MISSING LINE 1029
# MISSING LINE 1030
# MISSING LINE 1031
# MISSING LINE 1032
# MISSING LINE 1033
# MISSING LINE 1034
# MISSING LINE 1035
# MISSING LINE 1036
# MISSING LINE 1037
# MISSING LINE 1038
# MISSING LINE 1039
# MISSING LINE 1040
# MISSING LINE 1041
# MISSING LINE 1042
# MISSING LINE 1043
# MISSING LINE 1044
# MISSING LINE 1045
# MISSING LINE 1046
# MISSING LINE 1047
# MISSING LINE 1048
# MISSING LINE 1049
# MISSING LINE 1050
# MISSING LINE 1051
# MISSING LINE 1052
# MISSING LINE 1053
# MISSING LINE 1054
# MISSING LINE 1055
# MISSING LINE 1056
# MISSING LINE 1057
# MISSING LINE 1058
# MISSING LINE 1059
# MISSING LINE 1060
# MISSING LINE 1061
# MISSING LINE 1062
# MISSING LINE 1063
# MISSING LINE 1064
# MISSING LINE 1065
# MISSING LINE 1066
# MISSING LINE 1067
# MISSING LINE 1068
# MISSING LINE 1069
# MISSING LINE 1070
# MISSING LINE 1071
# MISSING LINE 1072
# MISSING LINE 1073
# MISSING LINE 1074
# MISSING LINE 1075
# MISSING LINE 1076
# MISSING LINE 1077
# MISSING LINE 1078
# MISSING LINE 1079
# MISSING LINE 1080
# MISSING LINE 1081
# MISSING LINE 1082
# MISSING LINE 1083
# MISSING LINE 1084
# MISSING LINE 1085
# MISSING LINE 1086
# MISSING LINE 1087
# MISSING LINE 1088
# MISSING LINE 1089
# MISSING LINE 1090
# MISSING LINE 1091
# MISSING LINE 1092
# MISSING LINE 1093
# MISSING LINE 1094
# MISSING LINE 1095
# MISSING LINE 1096
# MISSING LINE 1097
# MISSING LINE 1098
# MISSING LINE 1099
# MISSING LINE 1100
# MISSING LINE 1101
# MISSING LINE 1102
# MISSING LINE 1103
# MISSING LINE 1104
# MISSING LINE 1105
# MISSING LINE 1106
# MISSING LINE 1107
# MISSING LINE 1108
# MISSING LINE 1109
# MISSING LINE 1110
# MISSING LINE 1111
# MISSING LINE 1112
# MISSING LINE 1113
# MISSING LINE 1114
# MISSING LINE 1115
# MISSING LINE 1116
# MISSING LINE 1117
# MISSING LINE 1118
# MISSING LINE 1119
# MISSING LINE 1120
# MISSING LINE 1121
# MISSING LINE 1122
# MISSING LINE 1123
# MISSING LINE 1124
# MISSING LINE 1125
# MISSING LINE 1126
# MISSING LINE 1127
# MISSING LINE 1128
# MISSING LINE 1129
# MISSING LINE 1130
# MISSING LINE 1131
# MISSING LINE 1132
# MISSING LINE 1133
# MISSING LINE 1134
# MISSING LINE 1135
# MISSING LINE 1136
# MISSING LINE 1137
# MISSING LINE 1138
# MISSING LINE 1139
# MISSING LINE 1140
# MISSING LINE 1141
# MISSING LINE 1142
# MISSING LINE 1143
# MISSING LINE 1144
# MISSING LINE 1145
# MISSING LINE 1146
# MISSING LINE 1147
# MISSING LINE 1148
# MISSING LINE 1149
} catch (e) {
const status = e.response?.status;
const data = e.response?.data;
results.me = { success: false, httpStatus: status, error: e.message, rawData: data };
}
1156:   return res.json({ success: true, results });
# MISSING LINE 1156
});
1159: // GET /api/documents/test-local-wav2lip – test local python Wav2Lip checkpoints
# MISSING LINE 1159
router.get('/test-local-wav2lip', async (req, res) => {
const liveportraitScript = path.resolve(__dirname, '../python/liveportrait_animate.py');
1163:   let pythonCmd = 'python';
# MISSING LINE 1163
const candidates = [
path.resolve(__dirname, '../../../venv/Scripts/python.exe'),
path.resolve(__dirname, '../../venv/Scripts/python.exe'),
path.resolve(__dirname, '../../../../venv/Scripts/python.exe')
];
for (const p of candidates) {
if (fs.existsSync(p)) {
pythonCmd = `"${p}"`;
break;
}
}
1176:   // Find a sample image and video to run a valid test
# MISSING LINE 1176
const imgPath = path.resolve(__dirname, '../uploads/video/custom_avatar_1782459069267.jpg');
const videoPath = path.resolve(__dirname, '../uploads/video/girl_presenter.mp4');
const outPath = path.resolve(__dirname, '../uploads/video/test_animated.mp4');
1181:   // Load environment variables so python script gets HF_API_KEY
# MISSING LINE 1181
const env = { ...process.env };
1184:   const searchScript = path.resolve(__dirname, '../python/search_spaces.py');
# MISSING LINE 1184
const cmd = `${pythonCmd} "${searchScript}"`;
console.log('[Test LivePortrait] Running command:', cmd);
1188:   exec(cmd, { env }, (err, stdout, stderr) => {
# MISSING LINE 1188
const errorText = `
========================================
ERROR: ${err?.message || 'NONE'}
STDERR: ${stderr || 'NONE'}
STDOUT: ${stdout || 'NONE'}
========================================
`;
fs.writeFileSync(path.resolve(__dirname, '../liveportrait_test_error.txt'), errorText, 'utf8');
return res.json({
success: !err,
command: cmd,
error: err?.message || stderr,
stdout,
stderr
});
});
});
1207: 
# MISSING LINE 1207
1209: 
# MISSING LINE 1209
1211: // POST /api/documents/video – generate AI presenter video from document content
# MISSING LINE 1211
router.post('/video', async (req, res) => {
try {
const { content, title, gender = 'female', language = 'english', avatarUrl, localAvatarUrl, provider } = req.body ?? {};
if (!content || !content.trim()) {
