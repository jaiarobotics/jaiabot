#!/usr/bin/env python3

# JaiaBot Camera Driver version 0.0.1 alpha


import time
import os
import argparse
from jaiabot.messages.camera_driver_pb2 import *
import logging
import datetime
from typing import *
from jaia_serial import JaiaSerial
import subprocess
import signal


CAMERA_DRIVER_VERSION = 1


def parse_args():
    parser = argparse.ArgumentParser(description='JaiaBot Camera Driver')
    parser.add_argument('--device', required=True, help='Serial device to listen for camera commands')
    parser.add_argument('--simulate', action='store_true', help='Just print the commands, do not execute them')

    global args
    args = parser.parse_args()

    global log
    logging.basicConfig(level=logging.INFO)
    log = logging.getLogger('camera_driver')


def now_string():
    return datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f")


class MockCamera:

    def do_command(self, command: CameraCommand):
        log.info(command)


    def loop(self):
        pass


class Camera:
    image_capture_interval: float
    last_image_capture: float
    videoprocess: subprocess.Popen[bytes]
    directory: str


    def __init__(self):
        self.image_capture_interval = None
        self.last_image_capture = 0.0
        self.videoprocess = None
        self.directory = '/var/log/jaiabot/camera/'


    @property
    def output_dir(self):
        dir = self.directory + datetime.datetime.now().strftime('%Y-%m-%d')
        os.makedirs(dir, exist_ok=True)
        return dir


    def do_command(self, command: CameraCommand):
        log.info(f'Doing command: {command}')

        if command.type == CameraCommand.CameraCommandType.START_IMAGES:
            self.image_capture_interval = command.image_capture_interval
            

        elif command.type == CameraCommand.CameraCommandType.STOP_IMAGES:
            self.image_capture_interval = None
            

        elif command.type == CameraCommand.CameraCommandType.START_VIDEO:
            cmd = [
                'libcamera-vid', 
                '--codec', 'libav', 
                '-t', '600sec', 
                '-o', f'{self.output_dir}/video-{now_string()}.mp4'
            ]
            self.videoprocess = subprocess.Popen(cmd, stderr=subprocess.DEVNULL)

        
        elif command.type == CameraCommand.CameraCommandType.STOP_VIDEO:
            log.info('Sending SIGINT to libcamera-vid')
            self.videoprocess.send_signal(signal.SIGINT)
            try:
                self.videoprocess.wait(timeout=30)
            except subprocess.TimeoutExpired:
                log.info('Sending SIGTERM to libcamera-vid')
                self.videoprocess.terminate()
                self.videoprocess.wait(timeout=0.2)
                log.info('Done')

            
        else:
            log.warning(f'Unknown CameraCommand.type: {command.type}')


    def loop(self):
        if self.image_capture_interval is not None:
            t = time.time()
            if t - self.last_image_capture > self.image_capture_interval:
                self.last_image_capture = t
                os.system(f'libcamera-still -t 1 -o {self.output_dir}/image-{now_string()}.jpg')


def main():
    if args.simulate:
        cam = MockCamera()
    else:
        cam = Camera()

    port = JaiaSerial(args.device)

    while True:
        command = port.read(CameraCommand, timeout=0.1)

        if command is not None:
            log.info(f'Received command: {command}')

            response = CameraResponse()
            response.id = command.id

            if command.type == CameraCommand.CameraCommandType.GET_METADATA:
                response.metadata.driver_version = CAMERA_DRIVER_VERSION

            cam.do_command(command)

            port.write(response)
            log.info(f'Sent response: {response}')

        cam.loop()


if __name__ == '__main__':
    parse_args()
    main()
