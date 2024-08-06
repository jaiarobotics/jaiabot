try:
    import smbus
except:
    print('Try sudo apt-get install python-smbus')
    
from time import sleep

# Valid units
UNITS_Centigrade = 1
UNITS_Farenheit  = 2
UNITS_Kelvin     = 3

    
class TSYS01(object):
    
    # Registers
    _TSYS01_ADDR        = 0x77
    _TSYS01_PROM_READ   = 0xA0
    _TSYS01_RESET       = 0x1E
    _TSYS01_CONVERT     = 0x48
    _TSYS01_READ        = 0x00
    
    def __init__(self, bus=1):
        # Degrees C
        self._temperature = 0
        self._k = []
        
        try:
            self._bus = smbus.SMBus(bus)
        except:
            print("Bus %d is not available."%bus)
            print("Available busses are listed as /dev/i2c*")
            self._bus = None
        
        
    def init(self):
        if self._bus is None:
            "No bus!"
            return False
        
        self._bus.write_byte(self._TSYS01_ADDR, self._TSYS01_RESET)
        
        # Wait for reset to complete
        sleep(0.1)
        
        self._k = []

        # Read calibration values
        # Read one 16 bit byte word at a time
        for prom in range(0xAA, 0xA2-2, -2):
            k = self._bus.read_word_data(self._TSYS01_ADDR, prom)
            k =  ((k & 0xFF) << 8) | (k >> 8) # SMBus is little-endian for word transfers, we need to swap MSB and LSB
            self._k.append(k)
            
        return True
        
    def read(self):
        if self._bus is None:
            print("No bus!")
            return False
        
        # Request conversion
        self._bus.write_byte(self._TSYS01_ADDR, self._TSYS01_CONVERT)
    
        # Max conversion time = 9.04 ms
        sleep(0.01)
        
        adc = self._bus.read_i2c_block_data(self._TSYS01_ADDR, self._TSYS01_READ, 3)
        adc = adc[0] << 16 | adc[1] << 8 | adc[2]
        self._calculate(adc)
        return True

    # Temperature in requested units
    # default degrees C
    def temperature(self, conversion=UNITS_Centigrade):
        if conversion == UNITS_Farenheit:
            return (9/5) * self._temperature + 32
        elif conversion == UNITS_Kelvin:
            return self._temperature - 273
        return self._temperature

    # Cribbed from datasheet
    def _calculate(self, adc):
        adc16 = adc/256
        self._temperature = -2 * self._k[4] * 10**-21 * adc16**4 + \
            4  * self._k[3] * 10**-16 * adc16**3 +                \
            -2 * self._k[2] * 10**-11 * adc16**2 +                \
            1  * self._k[1] * 10**-6  * adc16   +                 \
            -1.5 * self._k[0] * 10**-2
            
        
