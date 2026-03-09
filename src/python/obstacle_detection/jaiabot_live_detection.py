import cv2
import time
import numpy as np
import os
import math
import pymoos
import threading
from flask import Flask, Response
from ultralytics import YOLO

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
MOOS_APP_NAME = "pYoloTracker"
MOOS_DB_HOST  = "localhost"
MOOS_DB_PORT  = 9004

CAM_HEIGHT = 0.5   # Meters above waterline
CAM_ANGLE  = 15.0  # Degrees tilted down from horizon
FOV_H      = 70.0  # Horizontal Field of View
IMG_W, IMG_H = 640, 480

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Note: Ensure this path is correct on your bot
MODEL_PATH = os.path.join("/var/log/jaiabot", "best.onnx") 

app = Flask(__name__)

class USVVisionBridge:
    def __init__(self):
        self.nav_x = 0.0
        self.nav_y = 0.0
        self.nav_heading = 0.0
        
        # Initialize MOOS Comms
        self.moos = pymoos.comms()
        self.moos.set_on_connect_callback(self.on_connect)
        
        # Start MOOS in a background thread
        self.moos_thread = threading.Thread(target=self._run_moos, daemon=True)
        self.moos_thread.start()

        # Load YOLO
        print(f"Loading model: {MODEL_PATH}")
        self.model = YOLO(MODEL_PATH, task='segment')

    def _run_moos(self):
        self.moos.run(MOOS_DB_HOST, MOOS_DB_PORT, MOOS_APP_NAME)

    def on_connect(self):
        print("Connected to MOOSDB")
        self.moos.register("NAV_X", 0)
        self.moos.register("NAV_Y", 0)
        self.moos.register("NAV_HEADING", 0)
        return True

    def update_nav(self):
        """Pull latest nav data from the MOOS buffer"""
        messages = self.moos.fetch()
        for msg in messages:
            val = msg.double()
            key = msg.key()
            if key == "NAV_X": self.nav_x = val
            elif key == "NAV_Y": self.nav_y = val
            elif key == "NAV_HEADING": self.nav_heading = val

    def pixel_to_local(self, u, v):
        """Converts pixel (u,v) to local USV forward/lateral meters"""
        cx = u - (IMG_W / 2)
        cy = (IMG_H / 2) - v 
        
        fov_v = FOV_H * (IMG_H / IMG_W)
        alpha_v = (cy / (IMG_H / 2)) * (fov_v / 2)
        total_angle_rad = math.radians(CAM_ANGLE + alpha_v)
        
        if total_angle_rad <= 0.05: 
            return None
        
        dist_f = CAM_HEIGHT / math.tan(total_angle_rad)
        alpha_h = (cx / (IMG_W / 2)) * (FOV_H / 2)
        dist_l = dist_f * math.tan(math.radians(alpha_h))
        
        return dist_f, dist_l

    def local_to_global(self, fwd, lat):
        """Rotates local meters into MOOS global XY space"""
        t = math.radians(self.nav_heading)
        gx = self.nav_x + fwd * math.sin(t) + lat * math.cos(t)
        gy = self.nav_y + fwd * math.cos(t) - lat * math.sin(t)
        return gx, gy

# --- Camera Discovery Logic ---

def get_first_working_camera(max_to_try=5):
    """Iterates through /dev/videoN to find the first available sensor."""
    for i in range(max_to_try):
        print(f"Checking camera index {i}...")
        cap = cv2.VideoCapture(i, cv2.CAP_V4L2)
        if cap.isOpened():
            # Try to grab one frame to verify it's not just a ghost device
            success, _ = cap.read()
            if success:
                print(f"🟢 Successfully connected to camera at index {i}")
                return cap
            cap.release()
    return None

# --- Main Logic ---

bridge = USVVisionBridge()

def gen_frames():
    cap = get_first_working_camera()
    
    if cap is None:
        print("🔴 FATAL: No working camera found. Check hardware connections.")
        return

    # Optimization settings
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, IMG_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, IMG_H)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) # Minimizes lag
    
    prev_time = 0

    while True:
        success, frame = cap.read()
        if not success:
            print("🟡 Lost camera signal. Attempting to reconnect...")
            cap.release()
            time.sleep(2)
            cap = get_first_working_camera()
            if cap is None: continue
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, IMG_W)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, IMG_H)
            continue

        # 1. Sync with MOOS
        bridge.update_nav()

        # 2. YOLO Inference
        # imgsz=320 is recommended for ARM64 real-time performance
        results = bridge.model(frame, imgsz=320, conf=0.2, verbose=False)
        r = results[0]
        annotated_frame = r.plot()

        # 3. Process Detections
        if r.boxes:
            for i, box in enumerate(r.boxes):
                coords = box.xyxy[0].cpu().numpy()
                x_mid = (coords[0] + coords[2]) / 2
                y_bottom = coords[3] 

                loc = bridge.pixel_to_local(x_mid, y_bottom)
                if loc:
                    fwd, lat = loc
                    gx, gy = bridge.local_to_global(fwd, lat)

                    # Post to MOOS
                    payload = f"x={gx:.2f},y={gy:.2f},label=obj_{i}"
                    bridge.moos.notify("TRACKED_FEATURE", payload)

        # 4. FPS Overlay
        curr_time = time.time()
        fps = 1 / (curr_time - prev_time) if prev_time != 0 else 0
        prev_time = curr_time
        cv2.putText(annotated_frame, f"FPS: {int(fps)}", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # 5. Flask Streaming
        _, buffer = cv2.imencode('.jpg', annotated_frame)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/')
def index():
    return """
    <html>
      <body style='background:#111; color:#eee; text-align:center; font-family:sans-serif;'>
        <h2>JaiaBot Vision Stream</h2>
        <img src='/video_feed' width='80%' style='border:5px solid #333; border-radius:10px;'>
        <p>Active MOOS App: pYoloTracker | Output: TRACKED_FEATURE</p>
      </body>
    </html>
    """

if __name__ == '__main__':
    # Listen on all interfaces (0.0.0.0) so you can view the stream from your laptop
    app.run(host='0.0.0.0', port=5000, threaded=True)