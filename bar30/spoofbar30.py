#!/usr/bin/python3
from time import sleep
from datetime import datetime
import random
import sys

#targetFile = sys.argv[1]
delay = 1.0

while True:
    now = datetime.utcnow()
    p_mbar = random.uniform(1300, 1400)
    t_celsius = random.uniform(20, 25)

    line = '%s,%9.2f,%7.2f\n' % (now.strftime('%Y-%m-%dT%H:%M:%SZ'), p_mbar, t_celsius)

    open('/tmp/bar30.txt', 'w').write(line)

    sleep(delay)
