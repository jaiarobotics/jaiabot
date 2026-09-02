import time
import smbus
import struct
import os

class KellerLD(object):

	_SLAVE_ADDRESS = 0x40
	_REQUEST_MEASUREMENT = 0xAC
	_DEBUG = False
	_P_MODES = (
		"PR Mode, Vented Gauge",   # Zero when front pressure == rear pressure
		"PA Mode, Sealed Gauge",   # Zero at 1.0 bar
		"PAA Mode, Absolute Gauge" # Zero at vacuum
	)
	_P_MODE_OFFSETS = (1.01325, 1.0, 0.0)

	def __init__(self, bus=1):
		self._bus = None

		try:
			self._bus = smbus.SMBus(bus)
		except:
			print("Bus %d is not available.") % bus
			print("Available busses are listed as /dev/i2c*")
			if os.uname()[1] == 'raspberrypi':
				print("Enable the i2c interface using raspi-config!")

	def init(self):
		if self._bus is None:
			print("No bus!")
			return False
		
		# Read out pressure-mode to determine relevant offset 
		self._bus.write_byte(self._SLAVE_ADDRESS, 0x12)
		time.sleep(0.001)
		# read three bytes (status, P MSB, P LSB)
		# status byte should be 0b01BMoEXX, where
		#   B=(0: conversion complete, 1:busy),
		#   Mo=(00:normal mode, 01:command mode, 1X: reserved)
		#   E=(0:checksum okay, 1:memory error)
		#   X=(don't care)
		data = self._bus.read_i2c_block_data(self._SLAVE_ADDRESS, 0, 3)
		
		scaling0 = data[1] << 8 | data[2]
		self.debug(("0x12:", scaling0, data))
		
		pModeID = scaling0 & 0b11
		self.pMode = self._P_MODES[pModeID]
		self.set_reference_pressure(self._P_MODE_OFFSETS[pModeID])
		
		self.year = scaling0 >> 11
		self.month = (scaling0 & 0b0000011110000000) >> 7
		self.day = (scaling0 & 0b0000000001111100) >> 2
		self.debug(("calibration date", self.year, self.month, self.day))
		
		# Read out minimum pressure reading
		time.sleep(0.001)
		self._bus.write_byte(self._SLAVE_ADDRESS, 0x13)
		time.sleep(0.001)
		data = self._bus.read_i2c_block_data(self._SLAVE_ADDRESS, 0, 3)
		
		MSWord = data[1] << 8 | data[2]
		self.debug(("0x13:", MSWord, data))

		time.sleep(0.001)
		self._bus.write_byte(self._SLAVE_ADDRESS, 0x14)
		time.sleep(0.001)
		data = self._bus.read_i2c_block_data(self._SLAVE_ADDRESS, 0, 3)

		LSWord = data[1] << 8 | data[2]
		self.debug(("0x14:", LSWord, data))

		self.pMin = MSWord << 16 | LSWord
		self.debug(("pMin", self.pMin))

		# Read out maximum pressure reading
		time.sleep(0.001)
		self._bus.write_byte(self._SLAVE_ADDRESS, 0x15)
		time.sleep(0.001)
		data = self._bus.read_i2c_block_data(self._SLAVE_ADDRESS, 0, 3)
		
		MSWord = data[1] << 8 | data[2]
		self.debug(("0x15:", MSWord, data))

		time.sleep(0.001)
		self._bus.write_byte(self._SLAVE_ADDRESS, 0x16)
		time.sleep(0.001)
		data = self._bus.read_i2c_block_data(self._SLAVE_ADDRESS, 0, 3)

		LSWord = data[1] << 8 | data[2]
		self.debug(("0x16:", LSWord, data))

		self.pMax = MSWord << 16 | LSWord
		self.debug(("pMax", self.pMax))
		
		# 'I' for 32bit unsigned int
		self.pMin = struct.unpack('f', struct.pack('I', self.pMin))[0]
		self.pMax = struct.unpack('f', struct.pack('I', self.pMax))[0]
		self.debug(("pMin:", self.pMin, "pMax:", self.pMax))

		return True

	def set_reference_pressure(self, pBar):
		""" Set the reference pressure for the sensor.
		
		Vented Gauge sensors are relative to the pressure on the rear/inside of the sensor
		element, so are more accurate if that reference value is kept updated from an aerial
		pressure sensor (e.g. inside an enclosure, or to the local atmospheric pressure if
		the sensor is installed in the wall of a water tank).
		"""
		self.pModeOffset = pBar
		self.debug(("pMode", self.pMode, "pressure offset [bar]", self.pModeOffset))

	def read(self):
		if self._bus is None:
			print("No bus!")
			return False
		
		if self.pMin is None or self.pMax is None:
			print("Init required!")
			print("Call init() at least one time before attempting to read()")
			return False

		self._bus.write_byte(self._SLAVE_ADDRESS, self._REQUEST_MEASUREMENT)

		time.sleep(0.01) #10 ms, plenty of time according to spec.

		data = self._bus.read_i2c_block_data(self._SLAVE_ADDRESS, 0, 5)

		statusByte = data[0]
		pressureRaw = data[1] << 8 | data[2]
		temperatureRaw = data[3] << 8 | data[4]

		'''
		# Always busy for some reason
		busy = statusByte & 1 << 5

		if busy:
			print("Conversion is not complete.")
			return
		'''

		# Validate the vendor-reserved framing bits before trusting the data.
		# A valid status byte is 0b01BMoEXX, so bit 7 must be 0 and bit 6 must
		# be 1. Anything else means the sensor is not returning a normal
		# measurement (e.g. 0x00 post-reset/not-ready, or 0xFF bus-stuck-high),
		# and the accompanying pressure/temperature bytes must not be trusted.
		if ((statusByte & 0b11 << 6) >> 6) != 0b01 :
			print(f"Invalid status byte: 0x{statusByte:02X}")
			return False

		if statusByte & 0b11 << 3 :
			print("Invalid mode: %d, expected 0!") % ((statusByte & 0b11 << 3) >> 3)
			return False

		if statusByte & 1 << 2 :
			print("Memory checksum error!")
			return False

		self._pressure = (pressureRaw - 16384) * (self.pMax - self.pMin) / 32768 + self.pMin + self.pModeOffset
		self._temperature = ((temperatureRaw >> 4) - 24) * 0.05 - 50

		self.debug(("data:", data))
		self.debug(("pressureRaw:", pressureRaw, "pressure:", self._pressure))
		self.debug(("temperatureRaw", temperatureRaw, "temperature:", self._temperature))

		return True


	def temperature(self):
		if self._temperature is None:
			print("Call read() first to get a measurement")
			return
		return self._temperature

	def pressure(self):
		if self._pressure is None:
			print("Call read() first to get a measurement")
			return
		return self._pressure

	def debug(self, msg):
		if self._DEBUG:
			print(msg)
	
	def __str__(self):
		return ("Keller LD I2C Pressure/Temperature Transmitter\n" +
			"\ttype: {}\n".format(self.pMode) +
			"\tcalibration date: {}-{}-{}\n".format(self.year, self.month, self.day) +
			"\tpressure offset: {:.5f} bar\n".format(self.pModeOffset) +
			"\tminimum pressure: {:.5f} bar\n".format(self.pMin) +
			"\tmaximum pressure: {:.5f} bar".format(self.pMax))


if __name__ == '__main__':

	sensor = KellerLD()
	if not sensor.init():
		print("Failed to initialize Keller LD sensor!")
		exit(1)
	print(sensor)

	while True:
		try:
			if sensor.read():
				print(f"pressure: {sensor.pressure():7.4f} bar\ttemperature: {sensor.temperature():0.2f} C")
			time.sleep(0.001)
		except Exception as e:
			print(e)
