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
MODEL_PATH = os.path.join("/var/log", "best.onnx") # Optimized for Pi

app = Flask(__name__)

class USVVisionBridge:
    def __init__(self):
        self.nav_x = 0.0
        self.nav_y = 0.0
        self.nav_heading = 0.0
        
        # Initialize MOOS Comms
        self.moos = pymoos.comms()
        self.moos.set_on_connect_callback(self.on_connect)
        
        # Start MOOS in a background thread so it doesn't block Python
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
        # Center the pixels: cx (horizontal), cy (vertical)
        # Note: In images, v=0 is top. We want cy positive for pixels near horizon.
        cx = u - (IMG_W / 2)
        cy = (IMG_H / 2) - v 
        
        # Vertical angle: CAM_ANGLE (tilt) + pixel offset angle
        fov_v = FOV_H * (IMG_H / IMG_W)
        alpha_v = (cy / (IMG_H / 2)) * (fov_v / 2)
        total_angle_rad = math.radians(CAM_ANGLE + alpha_v)
        
        # Avoid division by zero (objects at or above horizon)
        if total_angle_rad <= 0.05: 
            return None
        
        # Distance calculation (Flat Earth assumption)
        dist_f = CAM_HEIGHT / math.tan(total_angle_rad)
        
        # Lateral distance calculation
        alpha_h = (cx / (IMG_W / 2)) * (FOV_H / 2)
        dist_l = dist_f * math.tan(math.radians(alpha_h))
        
        return dist_f, dist_l

    def local_to_global(self, fwd, lat):
        """Rotates local meters into MOOS global XY space"""
        t = math.radians(self.nav_heading)
        # MOOS X is East (sin), Y is North (cos)
        gx = self.nav_x + fwd * math.sin(t) + lat * math.cos(t)
        gy = self.nav_y + fwd * math.cos(t) - lat * math.sin(t)
        return gx, gy

# --- Initialization ---
bridge = USVVisionBridge()

def gen_frames():
    # Use V4L2 backend for better performance on Linux/Pi
    cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, IMG_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, IMG_H)
    
    prev_time = 0

    while True:
        success, frame = cap.read()
        if not success:
            break

        # 1. Sync with MOOS
        bridge.update_nav()

        # 2. YOLO Inference (imgsz=320 for speed on Pi)
        results = bridge.model(frame, imgsz=320, conf=0.2, verbose=False)
        r = results[0]
        annotated_frame = r.plot()

        # 3. Process Detections
        if r.boxes:
            for i, box in enumerate(r.boxes):
                # Get bottom-center of the bounding box
                coords = box.xyxy[0].cpu().numpy()
                x_mid = (coords[0] + coords[2]) / 2
                y_bottom = coords[3] 

                loc = bridge.pixel_to_local(x_mid, y_bottom)
                if loc:
                    fwd, lat = loc
                    gx, gy = bridge.local_to_global(fwd, lat)

                    # Post to MOOS for pObstacleMgr
                    payload = f"x={gx:.2f},y={gy:.2f},label=obj_{i}"
                    bridge.moos.notify("TRACKED_FEATURE", payload)

        # 4. Performance Overlay
        curr_time = time.time()
        fps = 1 / (curr_time - prev_time) if prev_time != 0 else 0
        prev_time = curr_time
        cv2.putText(annotated_frame, f"FPS: {int(fps)}", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # 5. Stream back to Flask
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
        <p>Publishing to MOOS: TRACKED_FEATURE</p>
      </body>
    </html>
    """

if __name__ == '__main__':
    # host='0.0.0.0' allows access from other devices on the same network
    app.run(host='0.0.0.0', port=5000, threaded=True)
