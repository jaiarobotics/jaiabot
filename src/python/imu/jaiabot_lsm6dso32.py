#!/usr/bin/env python3
"""Read accelerometer + gyroscope data from an ST LSM6DSO32 over SPI and publish it
to jaiabot_udp_gateway as UDPGatewayEnvelope.imu_test_data (group jaiabot::imu_test).

Register addresses / values refer to the LSM6DSO32 datasheet (DocID032891 Rev 1).
"""
import argparse
import logging
import socket
import struct
import time
from math import radians

import spidev

from jaiabot.messages.imu_pb2 import IMUData
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

STANDARD_GRAVITY = 9.80665  # m/s^2 per g

# Registers (datasheet section 8)
WHO_AM_I = 0x0F     # fixed value 0x6C
CTRL1_XL = 0x10     # accel ODR / full scale
CTRL2_G = 0x11      # gyro ODR / full scale
CTRL3_C = 0x12      # BOOT, BDU, IF_INC, SW_RESET
CTRL9_XL = 0x18     # I3C_disable
OUTX_L_G = 0x22     # gyro X/Y/Z (0x22-0x27), then accel X/Y/Z (0x28-0x2D)

WHO_AM_I_VALUE = 0x6C
SPI_READ = 0x80     # bit 7 of the address byte = 1 for read

CTRL3_C_SW_RESET = 0x01
CTRL3_C_BDU_IF_INC = 0x44   # BDU=1 (no torn reads), IF_INC=1 (auto-increment)
CTRL9_XL_I3C_DISABLE = 0xE2 # default 0xE0 + I3C_disable, recommended when I3C is unused (Table 67)

ODR_104_HZ = 0x40           # ODR_XL / ODR_G = 0100 (high-performance mode)

# Full-scale selection -> (FS bits in CTRLx, sensitivity). Table 3, 45, 47.
ACCEL_FULL_SCALES = {       # g: (FS_XL bits, g/LSB)
    4: (0b00 << 2, 0.122e-3),
    8: (0b10 << 2, 0.244e-3),
    16: (0b11 << 2, 0.488e-3),
    32: (0b01 << 2, 0.976e-3),
}
GYRO_FULL_SCALES = {        # dps: (FS_G / FS_125 bits, dps/LSB)
    125: (0b001 << 1, 4.375e-3),
    250: (0b000 << 1, 8.75e-3),
    500: (0b010 << 1, 17.50e-3),
    1000: (0b100 << 1, 35.0e-3),
    2000: (0b110 << 1, 70.0e-3),
}


parser = argparse.ArgumentParser(description='Read acceleration and angular velocity from an LSM6DSO32 over SPI, and publish them over UDP port')
parser.add_argument('-p', dest='udp_gateway_port', type=int, default=20000, help='The jaiabot_udp_gateway port to send IMU data to (default: 20000)')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument('-r', dest='sampling_rate', default=10, type=float, choices=[1, 5, 10, 20, 50, 100], help='IMU sampling rate (Hz)')
parser.add_argument('-b', dest='spi_bus', default=1, type=int, help='SPI bus (default: 1)')
parser.add_argument('-c', dest='spi_cs', default=2, type=int, help='SPI chip select (default: 2, i.e. /dev/spidev1.2)')
parser.add_argument('-a', dest='accel_range', default=4, type=int, choices=sorted(ACCEL_FULL_SCALES), help='Accelerometer full scale (g)')
parser.add_argument('-g', dest='gyro_range', default=500, type=int, choices=sorted(GYRO_FULL_SCALES), help='Gyroscope full scale (dps)')


class Args:
    udp_gateway_port: int
    logging_level: str
    sampling_rate: float
    spi_bus: int
    spi_cs: int
    accel_range: int
    gyro_range: int


args: Args = parser.parse_args()


logging.basicConfig(format='%(levelname)10s %(name)25s %(message)s', level=args.logging_level)
log = logging.getLogger('jaiabot_lsm6dso32')
log.setLevel(args.logging_level)


class LSM6DSO32:
    def __init__(self, bus: int, cs: int, accel_range: int, gyro_range: int):
        self._bus = bus
        self._cs = cs
        self._accel_fs_bits, self._accel_sens = ACCEL_FULL_SCALES[accel_range]
        self._gyro_fs_bits, self._gyro_sens = GYRO_FULL_SCALES[gyro_range]
        self._spi = None
        self.is_setup = False

    def _write_reg(self, reg: int, val: int):
        self._spi.xfer2([reg & 0x7F, val])

    def _read_regs(self, reg: int, n: int):
        return self._spi.xfer2([reg | SPI_READ] + [0x00] * n)[1:]

    def setup(self):
        try:
            if self._spi is not None:
                self._spi.close()

            log.debug(f'Opening /dev/spidev{self._bus}.{self._cs}')
            self._spi = spidev.SpiDev()
            self._spi.open(self._bus, self._cs)
            self._spi.mode = 0                  # chip supports modes 0 and 3
            self._spi.max_speed_hz = 5_000_000  # chip max is 10 MHz

            who = self._read_regs(WHO_AM_I, 1)[0]
            if who != WHO_AM_I_VALUE:
                raise RuntimeError(f'WHO_AM_I = 0x{who:02X}, expected 0x{WHO_AM_I_VALUE:02X}. Check wiring / CS.')

            self._write_reg(CTRL3_C, CTRL3_C_SW_RESET)
            time.sleep(0.05)
            self._write_reg(CTRL3_C, CTRL3_C_BDU_IF_INC)
            self._write_reg(CTRL9_XL, CTRL9_XL_I3C_DISABLE)
            self._write_reg(CTRL1_XL, ODR_104_HZ | self._accel_fs_bits)
            self._write_reg(CTRL2_G, ODR_104_HZ | self._gyro_fs_bits)
            time.sleep(0.1)  # let the first samples arrive

            self.is_setup = True
            log.info(f'LSM6DSO32 set up on /dev/spidev{self._bus}.{self._cs} '
                     f'(+/-{args.accel_range} g, +/-{args.gyro_range} dps, 104 Hz)')
        except Exception as error:
            self.is_setup = False
            log.error(f'LSM6DSO32 setup error: {error}')

    def takeReading(self):
        """Returns an IMUData with acceleration (m/s^2) and angular_velocity (rad/s), or None on failure."""
        if not self.is_setup:
            self.setup()
            if not self.is_setup:
                return None

        try:
            raw = bytes(self._read_regs(OUTX_L_G, 12))
        except OSError as error:
            log.warning(f'SPI read failed, will re-initialize: {error}')
            self.is_setup = False
            return None

        gx, gy, gz, ax, ay, az = struct.unpack('<6h', raw)  # little-endian int16

        imu_data = IMUData()
        imu_data.acceleration.x = ax * self._accel_sens * STANDARD_GRAVITY
        imu_data.acceleration.y = ay * self._accel_sens * STANDARD_GRAVITY
        imu_data.acceleration.z = az * self._accel_sens * STANDARD_GRAVITY
        imu_data.angular_velocity.x = radians(gx * self._gyro_sens)
        imu_data.angular_velocity.y = radians(gy * self._gyro_sens)
        imu_data.angular_velocity.z = radians(gz * self._gyro_sens)
        imu_data.imu_type = 'lsm6dso32'
        return imu_data


def do_port_loop(imu: LSM6DSO32):
    address = ('localhost', args.udp_gateway_port)
    log.info(f'Communicating with jaiabot_udp_gateway on port {args.udp_gateway_port}.')

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', 0))

    sample_interval = 1.0 / args.sampling_rate

    while True:
        imu_data = imu.takeReading()

        if imu_data is None:
            log.warning('takeReading() returned None')
        else:
            envelope = UDPGatewayEnvelope(imu_test_data=imu_data)
            log.debug(f'Sending UDPGatewayEnvelope to jaiabot_udp_gateway at {address}:\n{envelope}')
            try:
                sock.sendto(envelope.SerializeToString(), address)
            except OSError as error:
                log.warning(f'Failed to send to jaiabot_udp_gateway: {error}')

        time.sleep(sample_interval)


if __name__ == '__main__':
    do_port_loop(LSM6DSO32(args.spi_bus, args.spi_cs, args.accel_range, args.gyro_range))
