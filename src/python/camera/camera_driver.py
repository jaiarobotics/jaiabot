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
        self.rpicam_proc = None
        self.ffmpeg_proc = None
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
            output_path = f'{self.output_dir}/video-{now_string()}.mp4'

            rpicam_cmd = [
                'rpicam-vid',
                '--codec', 'h264',
                '--inline',
                '--signal',
                '--output', '-',
            ]

            ffmpeg_cmd = [
                'ffmpeg',
                '-y',
                '-i', 'pipe:0',
                '-c:v', 'copy',
                output_path
            ]

            # Start rpicam-vid (producing raw h264 to stdout)
            self.rpicam_proc = subprocess.Popen(rpicam_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

            # Start ffmpeg (consuming from rpicam-vid)
            self.ffmpeg_proc = subprocess.Popen(ffmpeg_cmd, stdin=self.rpicam_proc.stdout, stderr=subprocess.PIPE)

        
        elif command.type == CameraCommand.CameraCommandType.STOP_VIDEO:
            log.info('Sending SIGINT to rpicam-vid')
            log.info('Stopping video recording')

            try:
                self.rpicam_proc.send_signal(signal.SIGINT)
                self.rpicam_proc.wait(timeout=30)
            except Exception as e:
                log.warning(f'Error stopping rpicam-vid: {e}')
                self.rpicam_proc.terminate()

            try:
                out, err = self.ffmpeg_proc.communicate(timeout=10)
                log.info(f'ffmpeg output: {out}')
                log.info(f'ffmpeg error: {err}')
            except Exception as e:
                log.warning(f'Error waiting for ffmpeg to finish: {e}')
                self.ffmpeg_proc.terminate()

            log.info('Done')

            
        else:
            log.warning(f'Unknown CameraCommand.type: {command.type}')


    def loop(self):
        if self.image_capture_interval is not None:
            t = time.time()
            if t - self.last_image_capture > self.image_capture_interval:
                self.last_image_capture = t
                os.system(f'rpicam-still --timeout 1 --output {self.output_dir}/image-{now_string()}.jpg')


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
