#!/bin/bash

timekeeper_dir="/etc/jaiabot/timekeeper"
timekeeper_file="${timekeeper_dir}/time.txt"

# Flags to prevent redundant system clock sets
gps_time_set=0
ntp_time_set=0

# Create directory if missing
if [ ! -d "${timekeeper_dir}" ]; then
  mkdir -p "${timekeeper_dir}"
  echo "Created ${timekeeper_dir}"
fi

# Restore saved time at boot (for fast startup)
if [ -e "${timekeeper_file}" ]; then
  read -r saved_time < "$timekeeper_file"
  echo "Restoring time from file: $saved_time"
  date -s "$saved_time"
else
  echo "No saved time file found."
fi

SECONDS=0
timeout=120

while true; do

  if (( SECONDS >= timeout )); then
    echo "Timeout: Moving on..."
    systemd-notify --ready
    SECONDS=0
  fi

  # Check NTP status
  ntp_status=$(timedatectl show --property=NTPSynchronized --value)

  if [[ $ntp_status == "yes" ]]; then
    if [[ $ntp_time_set -eq 0 ]]; then
      echo "NTP synchronized — marking ntp_time_set=1"
      ntp_time_set=1
    fi
    # Save time from NTP
    date > "$timekeeper_file"
    echo "Saved NTP time to $timekeeper_file"
  else
    echo "NTP not syncronized, skipping ntp check."
    # NTP not synced — try GPS if gpsd is active
    if systemctl is-active --quiet gpsd; then
      gps_time_iso=$(timeout 10 gpspipe -w -n 50 2>/dev/null | \
        grep '"class":"TPV"' | grep '"mode":[23]' | \
        sed -n 's/.*"time":"\([^"]*\)".*/\1/p' | tail -n1)

      if [[ -n "$gps_time_iso" ]]; then
        gps_time_fmt=$(echo "$gps_time_iso" | sed 's/T/ /; s/Z/ UTC/')
        echo "Got GPS time: $gps_time_fmt"

        # Set the system clock from GPS only once, and only if NTP hasn’t already set it
        if [[ $gps_time_set -eq 0 && $ntp_time_set -eq 0 ]]; then
          echo "Setting system clock from GPS once..."
          timedatectl set-time "$gps_time_fmt"
          gps_time_set=1
        fi

        # Always write GPS time to backup file
        echo "$gps_time_fmt" | tee "$timekeeper_file" >/dev/null
        echo "Saved GPS time to $timekeeper_file"
      else
        echo "No valid GPS time yet."
      fi
    else
      echo "Gpsd not active, skipping GPS time check."
    fi
  fi

  # Adjust sleep time: check faster until time is set by GPS or NTP
  if [[ $gps_time_set -eq 0 && $ntp_time_set -eq 0 ]]; then
    sleep 10
  else
    echo "Time set: Moving on..."
    systemd-notify --ready
    sleep 60
  fi
done
