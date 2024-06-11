#!/bin/bash

# Provides tools for the overlay filesystem


# sets JAIABOT_OVERLAY=true or false based on whether the current boot is 
# using the overlayfs
# also write OVERLAYCHROOT that can be used to execute a command in the overlaychroot
# (if overlay), or normally (if not overlay)
function is_overlay()
{
    local rootfstype=$(findmnt -n -o fstype /)
    [[ "${rootfstype}" == "overlay" ]] && JAIABOT_OVERLAY=true || JAIABOT_OVERLAY=false
    [[ "${JAIABOT_OVERLAY}" == "true" ]] && OVERLAYCHROOT=/usr/sbin/overlayroot-chroot || OVERLAYCHROOT=
}

is_overlay
