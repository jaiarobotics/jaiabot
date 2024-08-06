#!/usr/bin/python

import tsys01
import argparse
import socket
from time import sleep

parser = argparse.ArgumentParser(description='Read temperature from TSYS01 temperature sensor and publish it over UDP')
parser.add_argument('-p', '--port', dest='port', default=20005, help='Port to access temperature readings from TSYS01')
args = parser.parse_args()

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', args.port))

sensor = tsys01.TSYS01()

if not sensor.init():
    print("Error initializing sensor")
    exit(1)

while True:
    if not sensor.read():
        print("Error reading sensor")
        exit(1)

    temperature = sensor.temperature()
    print(temperature)

    sleep(0.1)
