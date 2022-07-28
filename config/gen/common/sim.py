from common import is_simulation, is_runtime
import os

try:
    warp=int(os.environ['jaia_warp'])
except:
    if is_simulation():
        warp=10
    else:
        warp=1
