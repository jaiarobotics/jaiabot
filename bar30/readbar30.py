#!/usr/bin/python
import ms5837
from time import sleep
import sys
from datetime import *

sensor = ms5837.MS5837_30BA() # Default I2C bus is 1 (Raspberry Pi 3)
#sensor = ms5837.MS5837_30BA(0) # Specify I2C bus
#sensor = ms5837.MS5837_02BA()
#sensor = ms5837.MS5837_02BA(0)
#sensor = ms5837.MS5837(model=ms5837.MS5837_MODEL_30BA, bus=0) # Specify model and bus

# We must initialize the sensor before reading it
if not sensor.init():
        print("Sensor could not be initialized")
        exit(1)

# We have to read values from sensor to update pressure and temperature
if not sensor.read():
    print("Sensor read failed!")
    exit(1)

sleep(5)

# Stream readings to file, overwriting each time
while True:
    sleep(1)
    try:
        if sensor.read():
            now = datetime.utcnow()
            p_mbar = sensor.pressure()
            t_celsius = sensor.temperature()

            line = '%s,%9.2f,%7.2f\n' % (now.strftime('%Y-%m-%dT%H:%M:%SZ'), p_mbar, t_celsius)

            outputFile = open('/tmp/bar30.txt', 'w')
            outputFile.write(line)
            outputFile.close()
        else:
            print("Sensor read failed!")
            exit(1)
    except OSError as error:
        # Temporary read errors come through as OSError exceptions
        print("Error: ", error)
