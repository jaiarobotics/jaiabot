#!/bin/bash
# Stop the Arduino driver, force-reflash firmware, and restart the driver.
set -euo pipefail

if [ -f /etc/jaiabot/runtime.env ]; then
    set -a
    # shellcheck source=/etc/jaiabot/runtime.env
    source /etc/jaiabot/runtime.env
    set +a
fi

TYPE="${jaia_arduino_type:-usb}"

if [ "${TYPE}" = "none" ]; then
    echo "jaia_arduino_type is none; skipping Arduino flash."
    exit 0
fi

DIR="/usr/share/jaiabot/arduino/jaiabot_runtime/${TYPE}"

if [ ! -x "${DIR}/upload.sh" ]; then
    echo "Arduino upload script not found: ${DIR}/upload.sh"
    exit 1
fi

systemctl stop jaiabot_driver_arduino
rm -f "${DIR}/jaiabot_runtime.ino.hex.uploaded"
"${DIR}/upload.sh"
systemctl start jaiabot_driver_arduino
