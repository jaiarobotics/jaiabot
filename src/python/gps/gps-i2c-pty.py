#!/usr/bin/env python3
import time
import smbus
import signal
import sys
import argparse
import os
import stat
import pty
import fcntl
import socket
import systemd.daemon

'''Send all the i2c gps data to gpsd over UDP, with a pty as a debugging tap.

The UDP feed is what allows gpsd to serve GPS time to chrony: gpsd refuses to
export time for a PTY-backed device, treating it as a test harness.
'''

parser = argparse.ArgumentParser()
parser.add_argument('pty_path')
parser.add_argument('--udp-host', default='127.0.0.1', help='Host running gpsd')
parser.add_argument('--udp-port', type=int, default=32100, help='UDP port gpsd is listening on')
args = parser.parse_args()

internal_pty, external_pty = pty.openpty()
try:
  os.remove(args.pty_path)
except:
  pass

external_pty_name=os.ttyname(external_pty)
os.symlink(external_pty_name, args.pty_path)
os.chmod(external_pty_name, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IWGRP |stat.S_IROTH | stat.S_IWOTH)

# nothing has to be reading the debug tap, so never let a full buffer stall the
# i2c loop
fcntl.fcntl(internal_pty, fcntl.F_SETFL,
            fcntl.fcntl(internal_pty, fcntl.F_GETFL) | os.O_NONBLOCK)
output = os.fdopen(internal_pty, "wb")

udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
udp_address = (args.udp_host, args.udp_port)

# Notify systemd after we have set up the PTY
# to ensure that dependencies (e.g. GPSD) can see it when they start
systemd.daemon.notify("READY=1")

BUS = None
address = 0x42
gpsReadInterval = 0.03

def connectBus():
    global BUS
    BUS = smbus.SMBus(1)


def parseResponse(gpsLine):
  if(gpsLine.count(36) == 1):                           # Check #1, make sure '$' doesnt appear twice
    if len(gpsLine) < 84:                               # Check #2, 83 is maximun NMEA sentenace length.
        CharError = 0;
        for c in gpsLine:                               # Check #3, Make sure that only readiable ASCII charaters and Carriage Return are seen.
            if (c < 32 or c > 122) and  c != 13:
                CharError+=1
        if (CharError == 0):#    Only proceed if there are no errors.
            gpsChars = ''.join(chr(c) for c in gpsLine)
            if (gpsChars.find('txbuf') == -1):          # Check #4, skip txbuff allocation error
                gpsStr, chkSum = gpsChars.split('*',2)  # Check #5 only split twice to avoid unpack error
                gpsComponents = gpsStr.split(',')
                chkVal = 0
                for ch in gpsStr[1:]: # Remove the $ and do a manual checksum on the rest of the NMEA sentence
                     chkVal ^= ord(ch)
                if (chkVal == int(chkSum, 16)): # Compare the calculated checksum with the one in the NMEA sentence
                     gpsChars = gpsChars.strip() + '\n'
                     udp_socket.sendto(bytes(gpsChars, "ascii"), udp_address)
                     try:
                         output.write(bytes(gpsChars, "ascii"))
                         output.flush()
                     except BlockingIOError:
                         pass


def handle_ctrl_c(signal, frame):
  output.close()
  sys.exit(130)

#This will capture exit when using Ctrl-C
signal.signal(signal.SIGINT, handle_ctrl_c)


def readGPS():
    c = None
    response = []
    try:
        while True: # Newline, or bad char.
            c = BUS.read_byte(address)
            if c == 255:
                return False
            elif c == 10:
                break
            else:
                response.append(c)
        parseResponse(response)
    except IOError:
        connectBus()
    except Exception as e:
        print(e)
connectBus()
while True:
    readGPS()
    time.sleep(gpsReadInterval)

