# ms5837-python

A python module to interface with MS5837-30BA and MS5837-02BA waterproof pressure and temperature sensors. Tested on Raspberry Pi 3 with Raspbian.

# Installation

The python SMBus library must be installed.

	sudo apt-get install python-smbus

Download this repository by clicking on the download button in this webpage, or using git:

```sh
git clone https://github.com/bluerobotics/ms5837-python
```

If you would like to try the example, move to the directory where you downloaded the repository, and run `python example.py`. To use the library, copy the `ms5837.py` file to your project/program directory and use this import statement in your program: `import ms5837`.

### Raspberry Pi

If you are using a Raspberry Pi, the i2c interface must be enabled. Run `sudo raspi-config`, and choose to enable the i2c interface in the `interfacing options`.

# Usage

	import ms5837

ms5837 provides a generic MS5837 class for use with different models

	MS5837(model=ms5837.MODEL_30BA, bus=1)

These model-specific classes inherit from MS5837 and don't have any unique members

	MS5837_30BA(bus=1)
	MS5837_02BA(bus=1)

An MS5837 object can be constructed by specifiying the model and the bus

	sensor = ms5837.MS5837() # Use defaults (MS5837-30BA device on I2C bus 1)
	sensor = ms5837.MS5837(ms5837.MODEL_02BA, 0) # Specify MS5837-02BA device on I2C bus 0

Or by creating a model-specific object

	sensor = ms5837.MS5837_30BA() # Use default I2C bus (1)
	sensor = ms5837.MS5837_30BA(0) # Specify I2C bus 0

### init()

Initialize the sensor. This needs to be called before using any other methods.

    sensor.init()

Returns true if the sensor was successfully initialized, false otherwise.

### read(oversampling=OSR_8192)

Read the sensor and update the pressure and temperature. The sensor will be read with the supplied oversampling setting. Greater oversampling increases resolution, but takes longer and increases current consumption.

    sensor.read(ms5837.OSR_256)

Valid arguments are:

    ms5837.OSR_256
    ms5837.OSR_512
    ms5837.OSR_1024
    ms5837.OSR_2048
    ms5837.OSR_4096
    ms5837.OSR_8192
        
Returns True if read was successful, False otherwise.

### setFluidDensity(density)

Sets the density in (kg/m^3) of the fluid for depth measurements. The default fluid density is ms5837.DENISTY_FRESHWATER.

	sensor.setFluidDensity(1000) # Set fluid density to 1000 kg/m^3
	sensor.setFluidDensity(ms5837.DENSITY_SALTWATER) # Use predefined saltwater density

Some convenient constants are:

	ms5837.DENSITY_FRESHWATER = 997
	ms5837.DENSITY_SALTWATER = 1029

### pressure(conversion=UNITS_mbar)

Get the most recent pressure measurement.

	sensor.pressure() # Get pressure in default units (millibar)
	sensor.pressure(ms5837.UNITS_atm) # Get pressure in atmospheres
	sensor.pressure(ms5837.UNITS_kPa) # Get pressure in kilopascal

Some convenient constants are:

	ms5837.UNITS_Pa     = 100.0
	ms5837.UNITS_hPa    = 1.0
	ms5837.UNITS_kPa    = 0.1
	ms5837.UNITS_mbar   = 1.0
	ms5837.UNITS_bar    = 0.001
	ms5837.UNITS_atm    = 0.000986923
	ms5837.UNITS_Torr   = 0.750062
	ms5837.UNITS_psi    = 0.014503773773022

Returns the most recent pressure in millibar * conversion. Call read() to update.

### temperature(conversion=UNITS_Centigrade)

Get the most recent temperature measurement.

	sensor.temperature() # Get temperature in default units (Centigrade)
	sensor.temperature(ms5837.UNITS_Farenheit) # Get temperature in Farenheit

Valid arguments are:

	ms5837.UNITS_Centigrade
	ms5837.UNITS_Farenheit
	ms5837.UNITS_Kelvin

Returns the most recent temperature in the requested units, or temperature in degrees Centigrade if invalid units specified. Call read() to update.

### depth()

Get the most recent depth measurement in meters.

	sensor.depth()

Returns the most recent depth in meters using the fluid density (kg/m^3) configured by setFluidDensity(). Call read() to update.

### altitude()

Get the most recent altitude measurement relative to Mean Sea Level pressure in meters.

	sensor.altitude()

Returns the most recent altitude in meters relative to MSL pressure using the density of air at MSL. Call read() to update.

