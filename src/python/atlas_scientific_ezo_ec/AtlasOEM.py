import smbus

class AtlasOEM(object):
    DEFAULT_BUS = 1
    
    def __init__(self, address, name = "", bus=None):
        self._address = address
        self.bus = smbus.SMBus(bus or self.DEFAULT_BUS)
        self._name = name
        
    def read_byte(self, reg):
        return self.bus.read_byte_data(self._address, reg)

    def read_16(self, reg):
        data = 0
        data = self.bus.read_byte_data(self._address, reg)<<8
        data |= self.bus.read_byte(self._address)
        return data

    def read_32u(self, reg):
        data = 0
        data = self.bus.read_byte_data(self._address, reg)<<24
        data |= self.bus.read_byte(self._address)<<16
        data |= self.bus.read_byte(self._address)<<8
        data |= self.bus.read_byte(self._address)
        return data
    
    def read_32(self, reg):
        data = 0
        data = self.bus.read_byte_data(self._address, reg)<<24
        data |= self.bus.read_byte(self._address)<<16
        data |= self.bus.read_byte(self._address)<<8
        data |= self.bus.read_byte(self._address)
        # python requires that we do it old school? 
        if((data >> 31) & 0x01):
            return -((~data & 0xFFFFFFFF) + 1)
        else:
            return data


    def write_byte(self, reg, val):
        self.bus.write_byte_data(self._address, reg, val)
        
    def write_16(self, reg, val):
        self.bus.write_byte_data(self._address, reg, (val>>8) & 0xFF)
        self.bus.write_byte_data(self._address, reg+1,(val) & 0xFF)
        
    def write_32(self, reg, val):
        self.bus.write_byte_data(self._address, reg, ((val>>24) & 0xFF))
        self.bus.write_byte_data(self._address, reg+1, (val>>16) & 0xFF)
        self.bus.write_byte_data(self._address, reg+2, (val>>8) & 0xFF)
        self.bus.write_byte_data(self._address, reg+3,(val) & 0xFF)

    def get_name(self):
        return self._name
    
    def read_device_data(self):
        return self.read_byte(0)

    def read_firmware_version(self):
        return self.read_byte(1)

    #address change regs here

    def read_interrrupt_control(self):
        return self.read_byte(0x04)

    def write_interrupt_control(self, val):
        self.write_byte(0x04, val)

    def read_led(self):
        return self.read_byte(0x05)

    def write_led(self, val):
        self.write_byte(0x05, val)
        
    def read_active_hibernate(self):
        return self.read_byte(0x06)

    def write_active_hibernate(self, val):
        self.write_byte(0x06, val)