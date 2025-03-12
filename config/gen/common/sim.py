from common import is_simulation, is_runtime, jaia_comms_modes, CommsMode
import os

try:
    warp=int(os.environ['jaia_warp'])
except:
    if is_simulation():
        if CommsMode.XBEE in jaia_comms_modes:
            warp=1
        else:
            warp=10
    else:
        warp=1
