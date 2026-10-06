#!/usr/bin/env python3
"""LSM6DSO32 SPI driver, published as imu_test_data (jaiabot::imu_test) for comparison against the BNO085.

Pitch/roll come from a Madgwick filter; yaw is the BNO085 heading forwarded by jaiabot_udp_gateway.
Orientation outputs reuse the BNO085 driver's code. Assumes both chips share a mounting orientation.

Register addresses / values refer to the LSM6DSO32 datasheet (DocID032891 Rev 1).
"""
import argparse
import logging
import os
import socket
import struct
import sys
import time
from math import cos, inf, radians, sin

import spidev

from jaiabot.messages.imu_pb2 import IMUData
from jaiabot.messages.udp_gateway_pb2 import UDPGatewayEnvelope

python_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.append(os.path.join(python_dir, 'utils'))
from madgwick import Madgwick

# Reuse the BNO085 driver's quaternion / IMUData code
sys.path.append(os.path.join(python_dir, 'adafruit'))
from imu_reading import IMUReading
from quaternion import Quaternion
from vector3 import Vector3

STANDARD_GRAVITY = 9.80665  # m/s^2 per g

# Registers (datasheet section 8)
WHO_AM_I = 0x0F     # fixed value 0x6C
CTRL1_XL = 0x10     # accel ODR / full scale
CTRL2_G = 0x11      # gyro ODR / full scale
CTRL3_C = 0x12      # BOOT, BDU, IF_INC, SW_RESET
CTRL9_XL = 0x18     # I3C_disable
CTRL10_C = 0x19     # TIMESTAMP_EN
WAKE_UP_SRC = 0x1B  # wake-up / free-fall / sleep state (0x1B), then TAP_SRC, D6D_SRC, STATUS_REG (0x1E)
OUT_TEMP_L = 0x20   # temperature (0x20-0x21), then gyro X/Y/Z (0x22-0x27), then accel X/Y/Z (0x28-0x2D)
TIMESTAMP0 = 0x40   # 32-bit timestamp counter (0x40-0x43), LSB first
TAP_CFG0 = 0x56     # LIR, INT_CLR_ON_READ
TAP_CFG2 = 0x58     # INTERRUPTS_ENABLE, INACT_EN
WAKE_UP_THS = 0x5B  # wake-up threshold
WAKE_UP_DUR = 0x5C  # sleep duration
FREE_FALL = 0x5D    # free-fall threshold / duration
INTERNAL_FREQ_FINE = 0x63  # ODR deviation from nominal

WHO_AM_I_VALUE = 0x6C
SPI_READ = 0x80     # bit 7 of the address byte = 1 for read

CTRL3_C_SW_RESET = 0x01
CTRL3_C_BDU_IF_INC = 0x44   # BDU=1 (no torn reads), IF_INC=1 (auto-increment)
CTRL9_XL_I3C_DISABLE = 0xE2 # default 0xE0 + I3C_disable, recommended when I3C is unused (Table 67)

ODR_104_HZ = 0x40           # ODR_XL / ODR_G = 0100 (high-performance mode)

CTRL10_C_TIMESTAMP_EN = 0x20
TAP_CFG0_LIR_CLR_ON_READ = 0x41  # latch events until read, clear on read, so polling doesn't miss them
TAP_CFG2_INTERRUPTS_ENABLE = 0x80  # INACT_EN = 00: stationary/motion detection only, ODRs unchanged
WAKE_UP_DUR_SLEEP_512_ODR = 0x01   # stationary after 512 ODR (~4.9 s at 104 Hz) without wake-up
FREE_FALL_312MG_6_ODR = 0x30       # FF_DUR = 6 ODR (~58 ms), FF_THS = 312 mg (Table 133)
WAKE_UP_THRESHOLD_G = 0.125        # rounded to WK_THS steps of FS_XL / 64

WAKE_UP_SRC_FF_IA = 0x20
WAKE_UP_SRC_SLEEP_STATE = 0x10
WAKE_UP_SRC_WU_IA = 0x08
STATUS_REG_TDA = 0x04
STATUS_REG_GDA = 0x02
STATUS_REG_XLDA = 0x01

TIMESTAMP_RESOLUTION_US = 25
FREQ_FINE_STEP_PERCENT = 0.15

TEMP_SENSITIVITY = 256.0    # LSB/degC, 0 LSB = 25 degC (Table 5)
TEMP_OFFSET_C = 25.0

SETUP_RETRY_INTERVAL = 5.0  # seconds between setup attempts after a failure

READ_RATE_HZ = 104          # sensor is read (and the orientation filter updated) at the sensor ODR
TIMESTAMP_WRAP = 2 ** 32
MAX_FILTER_DT = 0.5         # seconds; larger gaps (e.g. after a sensor error) restart integration

REFERENCE_HEADING_TIMEOUT = 1.0  # seconds without the BNO085 heading before the quaternion is no longer sent

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


parser = argparse.ArgumentParser(description='Read acceleration and angular velocity from an LSM6DSO32 over SPI, estimate orientation, and publish them over UDP port')
parser.add_argument('-p', dest='udp_gateway_port', type=int, default=20000, help='The jaiabot_udp_gateway port to send IMU data to (default: 20000)')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
parser.add_argument('-r', dest='sampling_rate', default=10, type=float, choices=[1, 5, 10, 20, 50, 100], help='IMU sampling rate (Hz)')
parser.add_argument('-b', dest='spi_bus', default=1, type=int, help='SPI bus (default: 1)')
parser.add_argument('-c', dest='spi_cs', default=2, type=int, help='SPI chip select (default: 2, i.e. /dev/spidev1.2)')
parser.add_argument('-a', dest='accel_range', default=4, type=int, choices=sorted(ACCEL_FULL_SCALES), help='Accelerometer full scale (g)')
parser.add_argument('-g', dest='gyro_range', default=500, type=int, choices=sorted(GYRO_FULL_SCALES), help='Gyroscope full scale (dps)')
parser.add_argument('--beta', dest='beta', default=0.1, type=float, help='Madgwick filter gain after convergence (default: 0.1)')


class Args:
    udp_gateway_port: int
    logging_level: str
    sampling_rate: float
    spi_bus: int
    spi_cs: int
    accel_range: int
    gyro_range: int
    beta: float


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
        self._wake_up_ths = max(1, min(63, round(WAKE_UP_THRESHOLD_G / (accel_range / 64))))
        self._odr_error_percent = 0.0
        self._spi = None
        # Registers written in setup that a power cycle resets to defaults, with their configured values
        self._expected_config = {
            CTRL1_XL: ODR_104_HZ | self._accel_fs_bits,
            CTRL2_G: ODR_104_HZ | self._gyro_fs_bits,
            CTRL10_C: CTRL10_C_TIMESTAMP_EN,
        }
        self.is_setup = False
        self._next_setup_time = 0.0
        self._last_setup_error = None

    def _write_reg(self, reg: int, val: int):
        self._spi.xfer2([reg & 0x7F, val])

    def _read_regs(self, reg: int, n: int):
        return self._spi.xfer2([reg | SPI_READ] + [0x00] * n)[1:]

    def setup(self):
        self._next_setup_time = time.monotonic() + SETUP_RETRY_INTERVAL
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
            for reg, val in self._expected_config.items():
                self._write_reg(reg, val)
            self._write_reg(TAP_CFG0, TAP_CFG0_LIR_CLR_ON_READ)
            self._write_reg(WAKE_UP_THS, self._wake_up_ths)
            self._write_reg(WAKE_UP_DUR, WAKE_UP_DUR_SLEEP_512_ODR)
            self._write_reg(FREE_FALL, FREE_FALL_312MG_6_ODR)
            self._write_reg(TAP_CFG2, TAP_CFG2_INTERRUPTS_ENABLE)
            freq_fine = struct.unpack('<b', bytes(self._read_regs(INTERNAL_FREQ_FINE, 1)))[0]
            self._odr_error_percent = freq_fine * FREQ_FINE_STEP_PERCENT
            time.sleep(0.1)  # let the first samples arrive

            self.is_setup = True
            self._last_setup_error = None
            log.info(f'LSM6DSO32 set up on /dev/spidev{self._bus}.{self._cs} '
                     f'(+/-{args.accel_range} g, +/-{args.gyro_range} dps, 104 Hz, '
                     f'ODR error {self._odr_error_percent:+.2f}%)')
        except Exception as error:
            self.is_setup = False
            # Log each distinct error once, rather than on every retry
            if str(error) != self._last_setup_error:
                log.error(f'LSM6DSO32 setup error (retrying every {SETUP_RETRY_INTERVAL:g} s): {error}')
                self._last_setup_error = str(error)
            else:
                log.debug(f'LSM6DSO32 setup error: {error}')

    def _check_connection(self):
        """Returns a description of the problem if the chip is missing or has lost its config, else None."""
        try:
            regs = self._read_regs(WHO_AM_I, CTRL10_C - WHO_AM_I + 1)
        except OSError as error:
            return f'SPI read failed: {error}'
        if regs[0] != WHO_AM_I_VALUE:
            return f'WHO_AM_I = 0x{regs[0]:02X}, expected 0x{WHO_AM_I_VALUE:02X} (sensor disconnected?)'
        for reg, expected in self._expected_config.items():
            actual = regs[reg - WHO_AM_I]
            if actual != expected:
                return f'Register 0x{reg:02X} = 0x{actual:02X}, expected 0x{expected:02X} (sensor reset?)'
        return None

    def takeReading(self):
        """Returns IMUData in SI units, or None on failure."""
        if not self.is_setup:
            if time.monotonic() < self._next_setup_time:
                return None
            self.setup()
            if not self.is_setup:
                return None

        try:
            # Status first, so the new-data flags describe the samples read next
            wake_up_src, _tap_src, _d6d_src, status = self._read_regs(WAKE_UP_SRC, 4)
            raw = bytes(self._read_regs(OUT_TEMP_L, 14))
            timestamp = struct.unpack('<I', bytes(self._read_regs(TIMESTAMP0, 4)))[0]
        except OSError as error:
            log.warning(f'SPI read failed, will re-initialize: {error}')
            self.is_setup = False
            return None

        # SPI has no ACK, so an unplugged chip reads back 0x00/0xFF and a replugged one comes back
        # powered down with default config, all without an error. Check identity and config instead.
        connection_error = self._check_connection()
        if connection_error is not None:
            log.warning(f'{connection_error}, will re-initialize')
            self.is_setup = False
            self._next_setup_time = 0.0  # retry immediately, then every SETUP_RETRY_INTERVAL
            return None

        temp, gx, gy, gz, ax, ay, az = struct.unpack('<7h', raw)  # little-endian int16

        imu_data = IMUData()
        imu_data.acceleration.x = ax * self._accel_sens * STANDARD_GRAVITY
        imu_data.acceleration.y = ay * self._accel_sens * STANDARD_GRAVITY
        imu_data.acceleration.z = az * self._accel_sens * STANDARD_GRAVITY
        imu_data.angular_velocity.x = radians(gx * self._gyro_sens)
        imu_data.angular_velocity.y = radians(gy * self._gyro_sens)
        imu_data.angular_velocity.z = radians(gz * self._gyro_sens)
        imu_data.temperature = TEMP_OFFSET_C + temp / TEMP_SENSITIVITY

        sensor_status = imu_data.sensor_status
        sensor_status.sensor_time = timestamp * TIMESTAMP_RESOLUTION_US
        sensor_status.new_acceleration = bool(status & STATUS_REG_XLDA)
        sensor_status.new_angular_velocity = bool(status & STATUS_REG_GDA)
        sensor_status.new_temperature = bool(status & STATUS_REG_TDA)
        sensor_status.free_fall = bool(wake_up_src & WAKE_UP_SRC_FF_IA)
        sensor_status.wake_up = bool(wake_up_src & WAKE_UP_SRC_WU_IA)
        sensor_status.stationary = bool(wake_up_src & WAKE_UP_SRC_SLEEP_STATE)
        sensor_status.odr_error_percent = self._odr_error_percent
        imu_data.imu_type = 'lsm6dso32'
        return imu_data


def sensor_dt(previous: IMUData, current: IMUData):
    """Seconds between samples from the sensor timestamp, corrected for ODR error."""
    counts = (current.sensor_status.sensor_time - previous.sensor_status.sensor_time) // TIMESTAMP_RESOLUTION_US
    counts %= TIMESTAMP_WRAP
    return counts * TIMESTAMP_RESOLUTION_US * 1e-6 / (1 + current.sensor_status.odr_error_percent / 100)


def accumulate_status(accumulated: IMUData.SensorStatus, latest: IMUData.SensorStatus):
    """Merge status across reads between sends, since flags clear on read."""
    accumulated.new_acceleration |= latest.new_acceleration
    accumulated.new_angular_velocity |= latest.new_angular_velocity
    accumulated.new_temperature |= latest.new_temperature
    accumulated.free_fall |= latest.free_fall
    accumulated.wake_up |= latest.wake_up
    accumulated.stationary = latest.stationary
    accumulated.sensor_time = latest.sensor_time
    accumulated.odr_error_percent = latest.odr_error_percent


def build_imu_data(ahrs: Madgwick, sample: IMUData, status: IMUData.SensorStatus, reference_heading):
    """reference_heading: BNO085 heading (deg) used as yaw, or None."""
    q_tilt = Quaternion(*ahrs.quaternion_wxyz())

    reading = IMUReading()
    reading.orientation = q_tilt.to_euler_angles()
    reading.acceleration = Vector3(sample.acceleration.x, sample.acceleration.y, sample.acceleration.z)
    reading.angular_velocity = Vector3(sample.angular_velocity.x, sample.angular_velocity.y, sample.angular_velocity.z)
    # Body frame, so independent of yaw
    reading.gravity = q_tilt.apply(Vector3(0, 0, STANDARD_GRAVITY))
    reading.linear_acceleration = reading.acceleration + (-1 * reading.gravity)

    if reference_heading is not None:
        # Swap in the BNO085 heading as yaw (+90 matches imu_bno085.py)
        own_heading = (reading.orientation.heading + 90) % 360
        yaw_change = radians(own_heading - reference_heading)
        q = Quaternion(cos(yaw_change / 2), 0, 0, sin(yaw_change / 2)) * q_tilt
        if q.w < 0:
            q = Quaternion(-q.w, -q.x, -q.y, -q.z)
        reading.quaternion = q
        reading.linear_acceleration_world = q.apply(reading.linear_acceleration)
    else:
        reading.linear_acceleration_world = Vector3(0, 0, 0)  # required by convertToIMUData; cleared below

    imu_data = reading.convertToIMUData()

    imu_data.euler_angles.ClearField('heading')  # reported only by the BNO085
    if reference_heading is None:
        imu_data.ClearField('linear_acceleration_world')

    imu_data.temperature = sample.temperature
    imu_data.sensor_status.CopyFrom(status)
    imu_data.imu_type = sample.imu_type
    return imu_data


def do_port_loop(imu: LSM6DSO32):
    address = ('localhost', args.udp_gateway_port)
    log.info(f'Communicating with jaiabot_udp_gateway on port {args.udp_gateway_port}.')

    # The gateway replies to this socket's address with the BNO085 heading
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', 0))
    sock.setblocking(False)

    read_interval = 1.0 / READ_RATE_HZ
    send_interval = 1.0 / args.sampling_rate

    ahrs = Madgwick(beta=args.beta)
    # Seed pitch/roll from the first sample
    initialize_orientation = True

    reference_heading = None
    reference_heading_time = -inf
    reference_heading_ok = False

    previous_sample = None
    status = IMUData.SensorStatus()
    reading_ok = True

    next_read = next_send = time.monotonic()

    while True:
        now = time.monotonic()

        # BNO085 heading, via jaiabot_udp_gateway
        while True:
            try:
                data, _ = sock.recvfrom(1024)
            except BlockingIOError:
                break
            try:
                envelope = UDPGatewayEnvelope.FromString(data)
            except Exception as error:
                log.warning(f'Could not parse UDPGatewayEnvelope from jaiabot_udp_gateway: {error}')
                continue
            if envelope.HasField('imu_reference_data') and envelope.imu_reference_data.euler_angles.HasField('heading'):
                reference_heading = envelope.imu_reference_data.euler_angles.heading
                reference_heading_time = now

        reference_heading_fresh = now - reference_heading_time < REFERENCE_HEADING_TIMEOUT
        if reference_heading_fresh != reference_heading_ok:
            if reference_heading_fresh:
                log.warning('BNO085 heading available: sending quaternion')
            else:
                log.warning('No BNO085 heading: sending pitch/roll only (no quaternion)')
            reference_heading_ok = reference_heading_fresh

        sample = imu.takeReading()

        if sample is None:
            if reading_ok:
                log.warning('No IMU data available; not sending until the sensor recovers')
            reading_ok = False
            previous_sample = None
            # The sensor may have moved while unavailable
            initialize_orientation = True
        else:
            if not reading_ok:
                log.warning('IMU data available again')
            reading_ok = True

            gyro = (sample.angular_velocity.x, sample.angular_velocity.y, sample.angular_velocity.z)
            accel = (sample.acceleration.x, sample.acceleration.y, sample.acceleration.z)

            if initialize_orientation:
                ahrs.initialize(accel)
                initialize_orientation = False

            if previous_sample is not None:
                dt = sensor_dt(previous_sample, sample)
                if 0 < dt <= MAX_FILTER_DT:
                    ahrs.update(gyro, accel, dt)
                    accumulate_status(status, sample.sensor_status)

                    if now >= next_send:
                        imu_data = build_imu_data(ahrs, sample, status,
                                                  reference_heading if reference_heading_fresh else None)
                        envelope = UDPGatewayEnvelope(imu_test_data=imu_data)
                        log.debug(f'Sending UDPGatewayEnvelope to jaiabot_udp_gateway at {address}:\n{envelope}')
                        try:
                            sock.sendto(envelope.SerializeToString(), address)
                        except OSError as error:
                            log.warning(f'Failed to send to jaiabot_udp_gateway: {error}')
                        status = IMUData.SensorStatus()
                        next_send = max(next_send + send_interval, now)

            previous_sample = sample

        next_read += read_interval
        delay = next_read - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        else:
            next_read = time.monotonic()  # fell behind; don't try to catch up


if __name__ == '__main__':
    do_port_loop(LSM6DSO32(args.spi_bus, args.spi_cs, args.accel_range, args.gyro_range))
