# KellerLD-python

A python module to interface with the LD line of pressure sensors from Keller. Tested on Raspberry Pi 3 with Raspbian.

See the [Keller Communication Protocol 4LD-9LD](http://www.keller-druck2.ch/swupdate/InstallerD-LineAddressManager/manual/Communication_Protocol_4LD-9LD_en.pdf) document for more details on the I2C communication protocol, and the [Keller 4LD-9LD Datasheet](https://download.keller-druck.com/api/download/2LfcGMzMbeHdjFbyUd5DWA/en/latest) for sensor specification details.

# Requirements

The python SMBus library must be installed.

	sudo apt-get install python-smbus

# Usage

	from kellerLD import KellerLD
	sensor = KellerLD()

### init()

Initialize the sensor. This needs to be called before using any other methods.

	sensor.init()

Returns true if the sensor was successfully initialized, false otherwise.

### read()

Read the sensor and update the pressure and temperature.

	sensor.read()

Returns True if read was successful, False otherwise.

### pressure()

Get the most recent pressure measurement.

	sensor.pressure()

Returns the most recent pressure in bar. Call read() to update.

#### set_reference_pressure(pBar)

Update the reference pressure value for PR Mode (Vented Gauge) sensors, in bar.

	local_atmosphere = 1.01325  # ideally read regularly from an air pressure sensor
	sensor.set_reference_pressure(local_atmosphere)

### temperature()

Get the most recent temperature measurement.

	sensor.temperature()

Returns the most recent temperature in degrees Centigrade. Call read() to update.

Source: https://github.com/bluerobotics/KellerLD-python
