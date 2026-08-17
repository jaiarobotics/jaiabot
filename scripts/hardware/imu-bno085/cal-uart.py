# SPDX-FileCopyrightText: 2020 Bryan Siepert, written for Adafruit Industries
#
# SPDX-License-Identifier: Unlicense
import time
import adafruit_bno08x
from adafruit_bno08x.uart import BNO08X_UART

print("Connecting...")

# for a USB Serial cable:
import serial
uart = serial.Serial("/dev/ttyAMA0", 3000000)

print("Set connection details")

bno = BNO08X_UART(uart)

print("Connected!!")

print("Starting Cal")

bno.begin_calibration()

bno.enable_feature(adafruit_bno08x.BNO_REPORT_MAGNETOMETER)
bno.enable_feature(adafruit_bno08x.BNO_REPORT_GAME_ROTATION_VECTOR)

start_time = time.monotonic()
calibration_good_at = None

while True:
    time.sleep(0.1)

    try:

        #print("Magnetometer:")
        mag_x, mag_y, mag_z = bno.magnetic  # pylint:disable=no-member
        #print("X: %0.6f  Y: %0.6f Z: %0.6f uT" % (mag_x, mag_y, mag_z))
        print("")

        #print("Game Rotation Vector Quaternion:")
        #(
        #    game_quat_i,
        #    game_quat_j,
        #    game_quat_k,
        #    game_quat_real,
        #) = bno.game_quaternion  # pylint:disable=no-member
        #print(
        #    "I: %0.6f  J: %0.6f K: %0.6f  Real: %0.6f"
        #    % (game_quat_i, game_quat_j, game_quat_k, game_quat_real)
        #)
        calibration_status = bno.calibration_status
        print(
            "Magnetometer Calibration quality:",
            adafruit_bno08x.REPORT_ACCURACY_STATUS[calibration_status],
            " (%d)" % calibration_status,
        )
        if not calibration_good_at and calibration_status > 2:
            calibration_good_at = time.monotonic()
        if calibration_good_at and (time.monotonic() - calibration_good_at > 5.0):
            input_str = input("\n\nEnter S to save or anything else to continue: ")
            if input_str.strip().lower() == "s":
                bno.save_calibration_data()
                break
            calibration_good_at = None
        print("**************************************************************")
    except RuntimeError as re:
        print("RuntimeError")
print("calibration done")
