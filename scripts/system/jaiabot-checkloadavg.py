#!/usr/bin/env python3

# Script waits until 1min load average goes below value provided as first argument
# e.g. 'jaiabot-checkloadavg.py 3.0' waits until the 1min load average drops below 3.0
import os
import time
import sys

max_load=float(sys.argv[1])
while os.getloadavg()[0] > max_load:
  print("Waiting for load average to drop below", max_load)
  time.sleep(1)

print("Load average is below", max_load)
