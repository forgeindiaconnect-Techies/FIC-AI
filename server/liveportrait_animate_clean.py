# server/python/liveportrait_animate.py
Completed At: 2026-06-30T08:51:33Z
File Path: `file:///c:/Users/Forgeindiaconnect/OneDrive/Documents/My-Projects/AI/forge-ai/server/python/liveportrait_animate.py`
Total Lines: 308
Total Bytes: 12506
Showing lines 1 to 90
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
# server/python/liveportrait_animate.py
import sys
import cv2
cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)
frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
cap.release()
def get_video_duration(video_path):
return frame_count / fps
except Exception as e:
cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)
frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
def split_video(video_path, chunk_duration, output_dir, ffmpeg_path):
os.makedirs(output_dir, exist_ok=True)
out_pattern = os.path.join(output_dir, 
except Exception as e:
ffmpeg_path, 
return 0

def split_video(video_path, chunk_duration, output_dir, ffmpeg_path):
os.makedirs(output_dir, exist_ok=True)
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
parts = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.startswith(
parts = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.startswith(
return parts
def concatenate_videos(video_paths, output_path, ffmpeg_path):
def concatenate_videos(video_paths, output_path, ffmpeg_path):
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for vp in video_paths:
parts = sorted([os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.startswith(
escaped_path = vp.replace(
f.write(f
def concatenate_videos(video_paths, output_path, ffmpeg_path):
temp_list = output_path + 
with open(temp_list, 
for vp in video_paths:
escaped_path = vp.replace(
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if os.path.exists(temp_list):
if os.path.exists(temp_list):
try: os.remove(temp_list)
except: pass
def enhance_video_faces(input_video_path, output_video_path, ffmpeg_path):
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(f
if os.path.exists(temp_list):
try: os.remove(temp_list)
from gfpgan import GFPGANer
device = 'cuda' if torch.cuda.is_available() else 'cpu'
def enhance_video_faces(input_video_path, output_video_path, ffmpeg_path):
# model_path=None will download/load the default GFPGANv1.4.pth
# model_path=None will download/load the default GFPGANv1.4.pth
enhancer = GFPGANer(
model_path=None, 
from gfpgan import GFPGANer
device = 'cuda' if torch.cuda.is_available() else 'cpu'
channel_multiplier=2, 
# model_path=None will download/load the default GFPGANv1.4.pth
enhancer = GFPGANer(
except Exception as init_err:
except Exception as init_err:
shutil.copy2(input_video_path, output_video_path)
shutil.copy2(input_video_path, output_video_path)
bg_upsampler=None,
device=device
cap = cv2.VideoCapture(input_video_path)
cap = cv2.VideoCapture(input_video_path)
if not cap.isOpened():
shutil.copy2(input_video_path, output_video_path)
shutil.copy2(input_video_path, output_video_path)
return
fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
temp_out = output_video_path + 
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(temp_out, fourcc, fps, (width, height))
out = cv2.VideoWriter(temp_out, fourcc, fps, (width, height))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
frame_idx = 0
temp_out = output_video_path + 
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(temp_out, fourcc, fps, (width, height))
break
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
# Enhance face frame
_, _, restored_img = enhancer.enhance(
frame, 
has_aligned=False, 
only_center_face=False, 
paste_back=True
)
out.write(restored_img)
except Exception as e:
out.write(frame)

frame_idx += 1
if frame_idx % 50 == 0:
print(f

cap.release()
out.release()

# Merge original audio from input_video_path to temp_out using ffmpeg
if os.path.exists(temp_out) and os.path.getsize(temp_out) > 0:
# Merge original audio from input_video_path to temp_out using ffmpeg
ffmpeg_path, 
merge_cmd = [
ffmpeg_path, 
subprocess.run(merge_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
]
subprocess.run(merge_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try: os.remove(temp_out)
if os.path.exists(temp_out):
try: os.remove(temp_out)
except: pass
except Exception as e:
print(f
shutil.copy2(input_video_path, output_video_path)
print(
def animate_single_video(client, source_image, video_path):
except Exception as e:
print(f
shutil.copy2(input_video_path, output_video_path)

def animate_single_video(client, source_image, video_path):
from gradio_client import handle_file
source_image_input = handle_file(source_image)
driving_video_input = {


}

errors = []
# Attempt 1: Named API parameters for /gpu_wrapped_execute_video
try:
result = client.predict(
param_0=source_image_input,
param_1=driving_video_input,
param_1=driving_video_input,
param_3=True,
param_4=True,
param_4=True,
api_name=
if result:
return result
except Exception as e1:
except Exception as e1:
errors.append(f
# Attempt 2: Positional arguments for /gpu_wrapped_execute_video
# Attempt 2: Positional arguments for /gpu_wrapped_execute_video
result = client.predict(
result = client.predict(
driving_video_input,
driving_video_input,
True,
True,
api_name=
api_name=
if result:
return result
except Exception as e2:
except Exception as e2:
errors.append(f
# Attempt 3: Default call without api_name
# Attempt 3: Default call without api_name
result = client.predict(
result = client.predict(
driving_video_input
driving_video_input
if result:
return result
except Exception as e3:
except Exception as e3:
errors.append(f
raise RuntimeError(f
raise RuntimeError(f
def main():
parser = argparse.ArgumentParser(description=
parser = argparse.ArgumentParser(description=
parser.add_argument(
parser.add_argument(
args = parser.parse_args()
args = parser.parse_args()
source_image = os.path.abspath(args.image)
driving_video = os.path.abspath(args.driving_video)
driving_video = os.path.abspath(args.driving_video)
output_path = os.path.abspath(args.output)
ffmpeg_path = os.environ.get(
print(f
print(f
# Check for Hugging Face Token in environment
# Check for Hugging Face Token in environment
hf_token = os.environ.get(
if not hf_token:
shutil.copy2(driving_video, output_path)
shutil.copy2(driving_video, output_path)
sys.exit(1)
try:
from gradio_client import Client, handle_file
from gradio_client import Client, handle_file
except ImportError:
import subprocess
import subprocess
subprocess.run([sys.executable, 
from gradio_client import Client, handle_file
from gradio_client import Client, handle_file
except Exception as inst_err:
except Exception as inst_err:
shutil.copy2(driving_video, output_path)
shutil.copy2(driving_video, output_path)
sys.exit(1)
try:
print(
# Handle different gradio_client version token parameter names
# Handle different gradio_client version token parameter names
client = Client(
except TypeError:
except TypeError:
client = Client(
except TypeError:
except TypeError:
client = Client(
# Write endpoints to debug log file
# Write endpoints to debug log file
api_info = client.view_api(return_format=
api_info = client.view_api(return_format=
f.write(api_info)
f.write(api_info)
except Exception as deb_err:
except Exception as deb_err:
print(f
# Check video duration to see if we need to split it
# Check video duration to see if we need to split it
duration = get_video_duration(driving_video)
print(f
animated_video_temp = output_path + 
animated_video_temp = output_path + 
if duration > 6.0:
if duration > 6.0:
# Create a unique temp folder for chunks
chunks_dir = os.path.join(os.path.dirname(output_path), f
parts = split_video(driving_video, 5, chunks_dir, ffmpeg_path)
parts = split_video(driving_video, 5, chunks_dir, ffmpeg_path)
animated_parts = []
for idx, part in enumerate(parts):
for idx, part in enumerate(parts):
pred_result = animate_single_video(client, source_image, part)
pred_result = animate_single_video(client, source_image, part)
# Parse return output
video_output = pred_result[0] if isinstance(pred_result, (tuple, list)) else pred_result
video_output = pred_result[0] if isinstance(pred_result, (tuple, list)) else pred_result
if isinstance(video_output, dict):
video_output = video_output.get(
if video_output and isinstance(video_output, str) and os.path.exists(video_output):
if video_output and isinstance(video_output, str) and os.path.exists(video_output):
animated_parts.append(video_output)
raise RuntimeError(f
raise RuntimeError(f
# Concatenate all animated segments
concatenate_videos(animated_parts, animated_video_temp, ffmpeg_path)
concatenate_videos(animated_parts, animated_video_temp, ffmpeg_path)
# Clean up chunks folder
try: shutil.rmtree(chunks_dir)
try: shutil.rmtree(chunks_dir)
except: pass
print(
pred_result = animate_single_video(client, source_image, driving_video)
video_output = pred_result[0] if isinstance(pred_result, (tuple, list)) else pred_result
video_output = pred_result[0] if isinstance(pred_result, (tuple, list)) else pred_result
if isinstance(video_output, dict):
video_output = video_output.get(
if video_output and isinstance(video_output, str) and os.path.exists(video_output):
if video_output and isinstance(video_output, str) and os.path.exists(video_output):
shutil.copy2(video_output, animated_video_temp)
raise RuntimeError(f
raise RuntimeError(f
# Run face enhancement on the final animated video using GFPGAN
enhance_video_faces(animated_video_temp, output_path, ffmpeg_path)
enhance_video_faces(animated_video_temp, output_path, ffmpeg_path)
# Clean up temp raw video
if os.path.exists(animated_video_temp):
if os.path.exists(animated_video_temp):
try: os.remove(animated_video_temp)
except: pass
print(f
print(f
except Exception as e:
except Exception as e:
shutil.copy2(driving_video, output_path)
shutil.copy2(driving_video, output_path)
sys.exit(1)
if __name__ == 
if __name__ == 
main()

