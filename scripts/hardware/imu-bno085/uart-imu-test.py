# SPDX-FileCopyrightText: 2020 Bryan Siepert, written for Adafruit Industries
#
# SPDX-License-Identifier: Unlicense
import time
import adafruit_bno08x
from adafruit_bno08x.uart import BNO08X_UART
from math import atan2, sqrt, pi

#import board  # pylint:disable=wrong-import-order
#import busio  # pylint:disable=wrong-import-order

#uart = busio.UART(board.TX, board.RX, baudrate=3000000, receiver_buffer_size=2048)

# uncomment and comment out the above for use with Raspberry Pi
#import serial
#uart = serial.Serial("/dev/serial0", 115200)

print("Connecting...")

# for a USB Serial cable:
import serial
uart = serial.Serial("/dev/ttyAMA0", 3000000)

print("Set connection details")

bno = BNO08X_UART(uart)

print("Connected!!")

bno.enable_feature(adafruit_bno08x.BNO_REPORT_ACCELEROMETER)
bno.enable_feature(adafruit_bno08x.BNO_REPORT_GYROSCOPE)
bno.enable_feature(adafruit_bno08x.BNO_REPORT_MAGNETOMETER)
bno.enable_feature(adafruit_bno08x.BNO_REPORT_ROTATION_VECTOR)
bno.enable_feature(adafruit_bno08x.BNO_REPORT_GEOMAGNETIC_ROTATION_VECTOR)

# More reports! Uncomment the enable line below along with the print
# in the loop below
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_LINEAR_ACCELERATION)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_GEOMAGNETIC_ROTATION_VECTOR)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_GAME_ROTATION_VECTOR)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_STEP_COUNTER)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_STABILITY_CLASSIFIER)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_ACTIVITY_CLASSIFIER)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_SHAKE_DETECTOR)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_RAW_ACCELEROMETER)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_RAW_GYROSCOPE)
# bno.enable_feature(adafruit_bno08x.BNO_REPORT_RAW_MAGNETOMETER)


def find_heading(dqw, dqx, dqy, dqz):
    norm = sqrt(dqw * dqw + dqx * dqx + dqy * dqy + dqz * dqz)
    dqw = dqw / norm
    dqx = dqx / norm
    dqy = dqy / norm
    dqz = dqz / norm

    ysqr = dqy * dqy

    t3 = +2.0 * (dqw * dqz + dqx * dqy)
    t4 = +1.0 - 2.0 * (ysqr + dqz * dqz)
    yaw_raw = atan2(t3, t4)
    yaw = yaw_raw * 180.0 / pi
    if yaw > 0:
        yaw = 360 - yaw
    else:
        yaw = abs(yaw)
    return yaw  # heading in 360 clockwise


while True:
    quat_i, quat_j, quat_k, quat_real = bno.quaternion
    heading = find_heading(quat_real, quat_i, quat_j, quat_k)
    print("Heading using rotation vector:", heading)

    # the geomagnetic sensor is unstable
    # Heading is calculated using geomagnetic vector
    geo_quat_i, geo_quat_j, geo_quat_k, geo_quat_real = bno.geomagnetic_quaternion
    heading_geo = find_heading(geo_quat_real, geo_quat_i, geo_quat_j, geo_quat_k)
    print("Heading using geomagnetic rotation vector:", heading_geo)
    print("")
    time.sleep(0.1)

