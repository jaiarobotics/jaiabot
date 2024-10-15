#!/usr/bin/env python3

import argparse
import socket
from threading import Thread
from jaiabot.messages.trinket_pb2 import trinket

parser = argparse.ArgumentParser(descripton='Read temperature from the ESC and publish it over UDP')
parser.add_argument('-p', '--port', dest='port', default=20006, help='Port to access trinket readings')
args = parser.parse_args()

import time
import serial

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', args.port))
buffer_size = 1024

# Temperature-to-ohms table as a dictionary
temperature_to_ohms = {
    -40: 277.2, -39: 263.6, -38: 250.1, -37: 236.8, -36: 224.0, -35: 211.5, -34: 199.6,
    -33: 188.1, -32: 177.3, -31: 167.0, -30: 157.2, -29: 148.1, -28: 139.4, -27: 131.3,
    -26: 123.7, -25: 116.6, -24: 110.0, -23: 103.7, -22: 97.9, -21: 92.50, -20: 87.43,
    -19: 82.79, -18: 78.44, -17: 74.36, -16: 70.53, -15: 66.92, -14: 63.54, -13: 60.34,
    -12: 57.33, -11: 54.50, -10: 51.82, -9: 49.28, -8: 46.89, -7: 44.62, -6: 42.48,
    -5: 40.45, -4: 38.53, -3: 36.70, -2: 34.97, -1: 33.33, 0: 31.77, 1: 30.25, 2: 28.82,
    3: 27.45, 4: 26.16, 5: 24.94, 6: 23.77, 7: 22.67, 8: 21.62, 9: 20.63, 10: 19.68,
    11: 18.78, 12: 17.93, 13: 17.12, 14: 16.35, 15: 15.62, 16: 14.93, 17: 14.26, 18: 13.63,
    19: 13.04, 20: 12.47, 21: 11.92, 22: 11.41, 23: 10.91, 24: 10.45, 25: 10.00, 26: 9.575,
    27: 9.170, 28: 8.784, 29: 8.416, 30: 8.064, 31: 7.730, 32: 7.410, 33: 7.106, 34: 6.815,
    35: 6.538, 36: 6.273, 37: 6.020, 38: 5.778, 39: 5.548, 40: 5.327, 41: 5.117, 42: 4.915,
    43: 4.723, 44: 4.539, 45: 4.363, 46: 4.195, 47: 4.034, 48: 3.880, 49: 3.733, 50: 3.592,
    51: 3.457, 52: 3.328, 53: 3.204, 54: 3.086, 55: 2.972, 56: 2.863, 57: 2.759, 58: 2.659,
    59: 2.564, 60: 2.472, 61: 2.384, 62: 2.299, 63: 2.218, 64: 2.141, 65: 2.066, 66: 1.994,
    67: 1.926, 68: 1.860, 69: 1.796, 70: 1.735, 71: 1.677, 72: 1.621, 73: 1.567, 74: 1.515,
    75: 1.465, 76: 1.417, 77: 1.371, 78: 1.326, 79: 1.284, 80: 1.243, 81: 1.203, 82: 1.165,
    83: 1.128, 84: 1.093, 85: 1.059, 86: 1.027, 87: 0.9955, 88: 0.9654, 89: 0.9363, 90: 0.9083,
    91: 0.8812, 92: 0.8550, 93: 0.8297, 94: 0.8052, 95: 0.7816, 96: 0.7587, 97: 0.7366, 98: 0.7152,
    99: 0.6945, 100: 0.6744
}

ohms_to_temperature = {
    277.2: -40, 263.6: -39, 250.1: -38, 236.8: -37, 224: -36, 211.5: -35,
    199.6: -34, 188.1: -33, 177.3: -32, 167: -31, 157.2: -30, 148.1: -29,
    139.4: -28, 131.3: -27, 123.7: -26, 116.6: -25, 110: -24, 103.7: -23,
    97.9: -22, 92.5: -21, 87.43: -20, 82.79: -19, 78.44: -18, 74.36: -17,
    70.53: -16, 66.92: -15, 63.54: -14, 60.34: -13, 57.33: -12, 54.5: -11,
    51.82: -10, 49.28: -9, 46.89: -8, 44.62: -7, 42.48: -6, 40.45: -5,
    38.53: -4, 36.7: -3, 34.97: -2, 33.33: -1, 31.77: 0, 30.25: 1,
    28.82: 2, 27.45: 3, 26.16: 4, 24.94: 5, 23.77: 6, 22.67: 7,
    21.62: 8, 20.63: 9, 19.68: 10, 18.78: 11, 17.93: 12, 17.12: 13,
    16.35: 14, 15.62: 15, 14.93: 16, 14.26: 17, 13.63: 18, 13.04: 19,
    12.47: 20, 11.92: 21, 11.41: 22, 10.91: 23, 10.45: 24, 10: 25,
    9.575: 26, 9.17: 27, 8.784: 28, 8.416: 29, 8.064: 30, 7.73: 31,
    7.41: 32, 7.106: 33, 6.815: 34, 6.538: 35, 6.273: 36, 6.02: 37,
    5.778: 38, 5.548: 39, 5.327: 40, 5.117: 41, 4.915: 42, 4.723: 43,
    4.539: 44, 4.363: 45, 4.195: 46, 4.034: 47, 3.88: 48, 3.733: 49,
    3.592: 50, 3.457: 51, 3.328: 52, 3.204: 53, 3.086: 54, 2.972: 55,
    2.863: 56, 2.759: 57, 2.659: 58, 2.564: 59, 2.472: 60, 2.384: 61,
    2.299: 62, 2.218: 63, 2.141: 64, 2.066: 65, 1.994: 66, 1.926: 67,
    1.86: 68, 1.796: 69, 1.735: 70, 1.677: 71, 1.621: 72, 1.567: 73,
    1.515: 74, 1.465: 75, 1.417: 76, 1.371: 77, 1.326: 78, 1.284: 79,
    1.243: 80, 1.203: 81, 1.165: 82, 1.128: 83, 1.093: 84, 1.059: 85,
    1.027: 86, 0.9955: 87, 0.9654: 88, 0.9363: 89, 0.9083: 90, 0.8812: 91,
    0.855: 92, 0.8297: 93, 0.8052: 94, 0.7816: 95, 0.7587: 96, 0.7366: 97,
    0.7152: 98, 0.6945: 99, 0.6744: 100, 0.6558: 101, 0.6376: 102, 0.6199: 103,
    0.6026: 104, 0.5858: 105, 0.5694: 106, 0.5535: 107, 0.538: 108, 0.5229: 109,
    0.5083: 110, 0.4941: 111, 0.4803: 112, 0.4669: 113, 0.4539: 114, 0.4412: 115,
    0.429: 116, 0.4171: 117, 0.4055: 118, 0.3944: 119, 0.3835: 120, 0.3628: 122,
    0.353: 123, 0.3434: 124, 0.3341: 125, 0.3253: 126, 0.3167: 127, 0.3083: 128,
    0.3002: 129, 0.2924: 130, 0.2848: 131, 0.2774: 132, 0.2702: 133, 0.2633: 134,
    0.2565: 135, 0.25: 136, 0.2437: 137, 0.2375: 138, 0.2316: 139, 0.2258: 140,
    0.2202: 141, 0.2148: 142, 0.2095: 143, 0.2044: 144, 0.1994: 145, 0.1946: 146,
    0.19: 147, 0.1855: 148, 0.1811: 149, 0.1769: 150, 0.1728: 151, 0.1688: 152,
    0.165: 153, 0.1612: 154, 0.1576: 155, 0.1541: 156, 0.1507: 157, 0.1474: 158,
    0.1441: 159, 0.141: 160, 0.1379: 161, 0.1321: 163, 0.1293: 164, 0.1265: 165,
    0.1239: 166, 0.1213: 167, 0.1187: 168, 0.1163: 169, 0.1139: 170, 0.1115: 171,
    0.1092: 172, 0.107: 173, 0.1048: 174, 0.1027: 175, 0.1006: 176, 0.0986: 177,
    0.0966: 178, 0.0947: 179, 0.0928: 180, 0.0909: 181, 0.0891: 182, 0.0873: 183,
    0.0856: 184, 0.0839: 185, 0.0822: 186, 0.0806: 187, 0.079: 188, 0.0774: 189,
    0.0759: 190, 0.0743: 191, 0.0729: 192, 0.0714: 193, 0.07: 194, 0.0686: 195,
    0.0672: 196, 0.0658: 197, 0.0645: 198, 0.0631: 199, 0.0619: 200
}

# Function to calculate resistance based on voltage
def calculate_resistance(voltage):
    return 10 * voltage / (3.3 - voltage)

# Linear interpolation function
def linear_interpolate(a, table):
    keys = sorted(table.keys())
    if a <= keys[0]:
        return table[keys[0]]
    elif a >= keys[-1]:
        return table[keys[-1]]
    else:
        lower_key = max(k for k in keys if k <= a)
        upper_key = min(k for k in keys if k >= a)
        lower_value = table[lower_key]
        upper_value = table[upper_key]
        return lower_value + (a - lower_key) * (upper_value - lower_value) / (upper_key - lower_key)

# Open the serial port
ser = serial.Serial('/dev/ttyACM0', 9600, timeout=1)

a0_voltage = 0
a4_voltage = 0

a0_resistance = 0
a4_resistance = 0

a0_temperature = 0
a4_temperature = 0

def query_trinket():
    while True:
        trinket_data = Trinket()
        trinket_data.a0_voltage = a0_voltage
        trinket_data.a4_voltage = a4_voltage

        trinket_data.a0_resistance = a0_resistance
        trinket_data.a4_resistance = a4_resistance

        trinket_data.a0_temperature = a0_temperature
        trinket_data.a4_temperature = a4_temperature

        try:
            data, addr = sock.recvfrom(buffer_size)
            sock.sendto(trinket_data.SerializeToString(), addr)
        except Exception as e:
            print(e)

def read_from_serial():
    try:
        global a0_voltage
        global a4_voltage
        global a0_resistance
        global a4_resistance
        global a0_temperature
        global a4_temperature

        while True:

            line = ser.readline().decode('utf-8').strip()

            # Print the raw line for debugging
            #print(f"Raw data: {line}")

            if line:
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

                try:
                    # Ensure the split works with consistent formatting
                    parts = line.replace(' ', '').split(',')
                    data = dict(item.split('=') for item in parts if '=' in item)

                    if 'A0' in data and 'A4' in data:
                        a0_voltage = float(data['A0'])
                        a4_voltage = float(data['A4'])

                        a0_resistance = calculate_resistance(a0_voltage)
                        a4_resistance = calculate_resistance(a4_voltage)

                        a0_temperature = linear_interpolate(a0_resistance, ohms_to_temperature)
                        a4_temperature = linear_interpolate(a4_resistance, ohms_to_temperature)

                        print(f"{timestamp} - A0: {a0_voltage:.2f}V, {a0_resistance:.2f}Ω, {a0_temperature:.2f}°C; "
                                f"A4: {a4_voltage:.2f}V, {a4_resistance:.2f}Ω, {a4_temperature:.2f}°C")
                    else:
                        print("Error: Data does not contain 'A1' or 'A4'")

                except ValueError as e:
                    print(f"Error parsing data: {e}")
                except KeyError as e:
                    print(f"Key error: {e}")
    finally:
        ser.close()
        #time.sleep(0.5)

def main():
    port_thread = Thread(target=query_trinket, name="port_thread", daemon=True)
    port_thread.start()

    read_from_serial()

    port_thread.join()

main()
