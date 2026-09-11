#!/bin/bash
# Stop the Arduino driver, force-reflash firmware, and restart the driver.
set -euo pipefail

driver_stopped=false

restart_driver_if_needed() {
    if [ "${driver_stopped}" = true ]; then
        systemctl start jaiabot_driver_arduino || true
    fi
}
trap restart_driver_if_needed EXIT

# the health service that runs this passes jaia_arduino_type in its unit environment;
# debconf is the fallback for a manual run
TYPE="${jaia_arduino_type:-$(jaia-debconf.sh get arduino_type none)}"

if [ "${TYPE}" = "none" ]; then
    echo "jaia_arduino_type is none; skipping Arduino flash."
    exit 0
fi

DIR="/usr/share/jaiabot/arduino/jaiabot_runtime/${TYPE}"

if [ ! -x "${DIR}/upload.sh" ]; then
    echo "Arduino upload script not found: ${DIR}/upload.sh"
    exit 1
fi

if [ "${TYPE}" = "usb" ]; then
    HEX_BASENAME="jaiabot_runtime.ino.hex"
else
    HEX_BASENAME="jaiabot_runtime.ino.with_bootloader.hex"
fi
UPLOADED_MARKER="${DIR}/${HEX_BASENAME}.uploaded"

systemctl stop jaiabot_driver_arduino || true
driver_stopped=true
rm -f "${UPLOADED_MARKER}"

upload_ok=false
if "${DIR}/upload.sh"; then
    upload_ok=true
fi

systemctl start jaiabot_driver_arduino || true
driver_stopped=false

if [ "${upload_ok}" = false ] || [ ! -f "${UPLOADED_MARKER}" ]; then
    echo "Arduino upload failed; uploaded marker not present: ${UPLOADED_MARKER}"
    exit 1
fi
