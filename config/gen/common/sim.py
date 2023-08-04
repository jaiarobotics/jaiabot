from common import is_simulation, is_runtime, jaia_comms_mode, CommsMode
import os

try:
    warp=int(os.environ['jaia_warp'])
except:
    if is_simulation():
        if jaia_comms_mode == CommsMode.XBEE:
            warp=1
        else:
            warp=10
    else:
        warp=1
