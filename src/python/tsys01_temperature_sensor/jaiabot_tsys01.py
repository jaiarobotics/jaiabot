#!/usr/bin/python

import tsys01
import argparse
import socket
from time import sleep
from jaiabot.messages.tsys01_pb2 import TSYS01Data

parser = argparse.ArgumentParser(description='Read temperature from TSYS01 temperature sensor and publish it over UDP')
parser.add_argument('-p', '--port', dest='port', default=20005, help='Port to access temperature readings from TSYS01')
args = parser.parse_args()

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', args.port))
buffer_size = 1024

sensor = tsys01.TSYS01()

if not sensor.init():
    print("Error initializing sensor")
    exit(1)

while True:
    data, addr = sock.recvfrom(buffer_size)
    tsys01_data = TSYS01Data()

    if not sensor.read():
        print("Error reading sensor")
        exit(1)

    tsys01_data.temperature = sensor.temperature()
    sock.sendto(tsys01_data.SerializeToString(), addr)
