#!/usr/bin/env python3
import time
import spidev
import signal
import sys
import argparse
import os
import stat
import pty
import systemd.daemon
import termios

'''Create a pty, and send all the spi gps data to it'''

parser = argparse.ArgumentParser()
parser.add_argument('pty_path')
args = parser.parse_args()

internal_pty, external_pty = pty.openpty()
try:
  os.remove(args.pty_path)
except:
  pass

external_pty_name=os.ttyname(external_pty)
os.symlink(external_pty_name, args.pty_path)
os.chmod(external_pty_name, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IWGRP |stat.S_IROTH | stat.S_IWOTH)

output = os.fdopen(internal_pty, "wb")

# Notify systemd after we have set up the PTY
# to ensure that dependencies (e.g. GPSD) can see it when they start
systemd.daemon.notify("READY=1")

SPI = None

def connectSPI():
    global SPI
    SPI = spidev.SpiDev()
    SPI.open(1,1)
    SPI.max_speed_hz = 5000000
    SPI.mode = 0

    # Enable the UBX protocol
    ubx_enable = [0xB5, 0x62, 0x06, 0x01, 0x03, 0x00, 0xF0, 0x00, 0xF9]
    SPI.xfer2(ubx_enable)
    
    time.sleep(0.1)

    # Set the Navigation Rate to 5Hz
    nav_rate = [0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0xC8, 0x00, 0x01, 0x00, 0x01, 0x00, 0xDE, 0x6A]
    SPI.xfer2(nav_rate)

    # Wait for GPS module to respond
    # This delay gives the GPS module time to configure itself
    time.sleep(0.1)

def handle_ctrl_c(signal, frame):
  output.close()
  # Disconnects from the SPI device.
  SPI.close()
  sys.exit(130)

# This will capture exit when using Ctrl-C
signal.signal(signal.SIGINT, handle_ctrl_c)

connectSPI()
while True:
    # Flush before next request
    termios.tcflush(internal_pty, termios.TCIFLUSH)

    # Send request to GPS module to output all NMEA strings
    SPI.writebytes([0xB5, 0x62, 0x06, 0x01, 0x03, 0x00, 0xF0, 0x01, 0x00, 0xFA, 0x00])

    # Wait for GPS module to respond
    time.sleep(0.01)

    # Read GPS NMEA strings
    # The argument to readbytes specifies the number of bytes to read
    # In this case, we're reading 400 bytes, which should be enough to capture all of the NMEA strings that the module outputs
    nmea_data = SPI.readbytes(400)

    # Write GPS NMEA strings to pty device for gpsd to read from
    # We convert the list of integers to a string of characters using a list comprehension and the chr() function
    # We then join the characters into a single string using the "".join() method
    # Finally, we convert the string to bytes using the 'utf-8' encoding and write it to the pty device using os.write()
    os.write(internal_pty, bytes("".join([chr(x) for x in nmea_data]), 'utf-8'))
    

