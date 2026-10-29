#!/bin/bash

timekeeper_dir="/etc/jaiabot/timekeeper"
timekeeper_file="${timekeeper_dir}/time.txt"
ready_flag="${timekeeper_dir}/READY"

# Flags to prevent redundant system clock sets
gps_time_set=0
ntp_time_set=0
setting_time_timeout=0
ready_flag_created=0

# Create directory if missing
if [ ! -d "${timekeeper_dir}" ]; then
  mkdir -p "${timekeeper_dir}"
  echo "Created ${timekeeper_dir}"
fi

# Remove ready flag at the start
rm -f "$ready_flag"

start_time=$(date +%s)
timeout_duration=120

while true; do
  # Check chrony status (synchronized, with a stratum between 1 and 15)
  chrony_tracking=$(chronyc -c tracking 2>/dev/null)
  chrony_stratum=$(echo "$chrony_tracking" | cut -d, -f3)
  chrony_leap=$(echo "$chrony_tracking" | cut -d, -f14)

  if [[ "$chrony_stratum" =~ ^[0-9]+$ ]] && [[ $chrony_stratum -ge 1 ]] &&
     [[ $chrony_stratum -le 15 ]] && [[ "$chrony_leap" != "Not synchronised" ]]; then
    ntp_peer_synced="yes"
  else
    ntp_peer_synced="no"
  fi

  if [[ $ntp_peer_synced == "yes" ]]; then
    echo "Chrony Synchronized (stratum 1-15)"

    if [[ $ntp_time_set -eq 0 ]]; then
      ntp_time_set=1
    fi

    # Save time from NTP
    date > "$timekeeper_file"
    echo "Saved NTP time to $timekeeper_file"

    if [[ $ready_flag_created -eq 0 ]]; then
      echo "Ready Flag Created"
      touch "$ready_flag"
      ready_flag_created=1
    fi
    sleep 60
    continue
  else
    echo "NTP not synchronized, checking GPS..."
  fi

  ## Check GPS Status (capture once, evaluate based on timeout)
  gps_line=""
  ept=""
  iso=""
  gps_time_fmt=""
  has_good_mode=0
  has_good_ept=0
  
  if systemctl is-active --quiet gpsd; then
    echo "Attempting to get GPS time..."
    gps_line=$(timeout 10 gpspipe -w -n 50 2>/dev/null | grep '"class":"TPV"' | tail -n1)
    
    if [[ -n "$gps_line" ]]; then
      # Extract EPT and ISO time once
      ept=$(echo "$gps_line" | sed -n 's/.*"ept":\([0-9.e+-]*\).*/\1/p')
      iso=$(echo "$gps_line" | sed -n 's/.*"time":"\([^"]*\)".*/\1/p')
      
      # Convert ISO to formatted time once
      if [[ -n "$iso" ]]; then
        gps_time_fmt=$(echo "$iso" | sed 's/T/ /; s/Z/ UTC/')
      fi
      
      # Check if we have good mode (2 or 3)
      if echo "$gps_line" | grep -q '"mode":[23]'; then
        has_good_mode=1
      fi
      
      # Check EPT once (used by both normal and degraded mode)
      if [[ -n "$ept" ]] && awk -v e="$ept" 'BEGIN{exit !(e <= 0.5)}'; then
        has_good_ept=1
      fi  

      # Normal mode: require mode 2/3 and EPT <= 0.5
      if [[ $has_good_mode -eq 1 && $has_good_ept -eq 1 && -n "$gps_time_fmt" ]]; then
        echo "Got good GPS time (mode 2/3, EPT=$ept): $gps_time_fmt"
        
        # Set system clock from GPS if not already set
        if [[ $gps_time_set -eq 0 && $ntp_time_set -eq 0 ]]; then
          echo "Setting system clock from GPS..."
          timedatectl set-time "$gps_time_fmt"
          gps_time_set=1
        fi
        
        # Save GPS time to backup file
        echo "$gps_time_fmt" > "$timekeeper_file"
        echo "Saved GPS time to $timekeeper_file"
        
        if [[ $ready_flag_created -eq 0 ]]; then
          echo "Ready Flag Created"
          touch "$ready_flag"
          ready_flag_created=1
        fi
        sleep 60
        continue
      else
        if [[ $has_good_mode -eq 0 ]]; then
          echo "GPS mode not 2 or 3"
        fi
        if [[ $has_good_ept -eq 0 ]]; then
          echo "GPS EPT too high: $ept"
        fi
      fi
    else
      echo "No GPS data received"
    fi
  else
    echo "Gpsd not active, skipping GPS time check."
  fi

  ## Check timeout - enter degraded mode if needed
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))

  if [[ $elapsed -gt $timeout_duration && $setting_time_timeout -eq 0 ]]; then
    echo "========================================="
    echo "Reached ${timeout_duration}s timeout - entering degraded mode"
    echo "========================================="
    setting_time_timeout=1
    
    # Try degraded GPS mode using already-captured GPS data (any mode, just check EPT)
    if [[ $has_good_ept -eq 1 && -n "$gps_time_fmt" ]]; then
      echo "Got degraded GPS time (EPT=$ept): $gps_time_fmt"
      
      if [[ $gps_time_set -eq 0 && $ntp_time_set -eq 0 ]]; then
        echo "Setting system clock from degraded GPS..."
        timedatectl set-time "$gps_time_fmt"
        gps_time_set=1
      fi
      
      # Save to backup file
      echo "$gps_time_fmt" > "$timekeeper_file"
      echo "Saved degraded GPS time to $timekeeper_file"
      
      if [[ $ready_flag_created -eq 0 ]]; then
        echo "Ready Flag Created"
        touch "$ready_flag"
        ready_flag_created=1
      fi
      sleep 60
      continue
    else
      if [[ $has_good_ept -eq 0 ]]; then
        echo "Degraded GPS EPT still too high: $ept"
      else
        echo "No GPS data available for degraded mode"
      fi
    fi
    
    # Last resort: restore from backup file if it's ahead of current time
    if [[ $gps_time_set -eq 0 && $ntp_time_set -eq 0 ]]; then
      if [ -e "${timekeeper_file}" ]; then
        read -r saved_time < "$timekeeper_file"
        saved_epoch=$(date -d "$saved_time" +%s 2>/dev/null)
        current_epoch=$(date +%s)
        
        if [[ $saved_epoch -gt 0 ]] && [[ $saved_epoch -gt $current_epoch ]]; then
          echo "Current time ($current_epoch) is behind saved time ($saved_epoch)"
          echo "Restoring time from file: $saved_time"
          date -s "$saved_time"
        else
          echo "Current system time is already ahead of saved time - no restore needed"
        fi
      else
        echo "No saved time file found - continuing with system time"
      fi
      
      if [[ $ready_flag_created -eq 0 ]]; then
        echo "Ready Flag Created (Degraded Mode)"
        touch "$ready_flag"
        ready_flag_created=1
      fi

      sleep 60
      continue
    fi
  fi

  # Adaptive sleep: check frequently until we have a good time, then slow down
  if [[ $gps_time_set -eq 0 && $ntp_time_set -eq 0 && $setting_time_timeout -eq 0 ]]; then
    # Still searching for a reliable time source - check frequently
    sleep 10
  else
    # We have a time source (NTP, GPS, or fallback) - check less frequently
    sleep 60
  fi
done