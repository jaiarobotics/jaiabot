#!/usr/bin/env python3
"""Menu-driven tester for jaiabot_driver_imu, formerly jaiabot_imu.py -i."""
import sys
import threading

import goby
from jaiabot_imu_test_goby import SingleThreadApplication, groups
from jaiabot.messages.imu_pb2 import IMUData, IMUCommand

MENU = '''
    Menu
    ====

    Raw commands:
    [Enter]    Show the latest IMU reading
    [w]        Start sampling for wave height
    [e]        Stop sampling for wave height
    [s]        Start sampling for bottom type
    [d]        Stop sampling for bottom type

    Other commands:
    [h]        Significant Wave Height analysis

    [x]        Exit
'''

COMMAND_FOR_CHOICE = {
    'w': IMUCommand.START_WAVE_HEIGHT_SAMPLING,
    'e': IMUCommand.STOP_WAVE_HEIGHT_SAMPLING,
    's': IMUCommand.START_BOTTOM_TYPE_SAMPLING,
    'd': IMUCommand.STOP_BOTTOM_TYPE_SAMPLING,
}


class JaiabotIMUTest(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=10)
        self._latest = None
        self._pending = []
        self._lock = threading.Lock()

        self.interprocess().subscribe(groups.imu, IMUData, self._on_data)

        # input() blocks, so the menu runs on a thread of its own and hands work to loop()
        threading.Thread(target=self._menu, name='menu', daemon=True).start()

    def _on_data(self, data: IMUData) -> None:
        with self._lock:
            self._latest = data

    def _send(self, command_type, sample_rate=None):
        command = IMUCommand(type=command_type)
        if sample_rate is not None:
            command.sample_rate = sample_rate
        with self._lock:
            self._pending.append(command)

    def loop(self):
        with self._lock:
            pending, self._pending = self._pending, []
        for command in pending:
            self.interprocess().publish(groups.imu, command)

    def _menu(self):
        while True:
            print(MENU)
            choice = input('Command >> ').lower()
            print()

            if choice == 'x':
                self.quit()
                return
            if choice == '':
                with self._lock:
                    latest = self._latest
                print(f'RECEIVED:\n{latest}' if latest else 'no IMUData received yet')
                continue
            if choice == 'h':
                duration = float(input('Sample for how long (seconds)? '))
                self._send(IMUCommand.START_WAVE_HEIGHT_SAMPLING)
                print('Sampling for significant wave height...')
                goby.time.sleep(duration)
                with self._lock:
                    latest = self._latest
                self._send(IMUCommand.STOP_WAVE_HEIGHT_SAMPLING)
                print(f'Results:\n{latest}')
                continue

            command_type = COMMAND_FOR_CHOICE.get(choice)
            if command_type is None:
                print(f'ERROR: unknown command "{choice}"\n')
                continue
            self._send(command_type)
            print(f'  SENT: {IMUCommand.IMUCommandType.Name(command_type)}\n')


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotIMUTest))
