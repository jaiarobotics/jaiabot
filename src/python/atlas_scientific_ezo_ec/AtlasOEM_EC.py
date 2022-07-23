from AtlasOEM import AtlasOEM

class AtlasOEM_EC(AtlasOEM):
    
    DEFAULT_ADDRESS = 0x64
    
    def __init__(self, address=None, name = "", bus=None):
        super(AtlasOEM_EC, self).__init__((address or self.DEFAULT_ADDRESS), name, bus)
        
    def read_new_reading_available(self):
        return self.read_byte(0x07)

    def write_new_reading_available(self, val):
        self.write_byte(0x07, val)

    def write_probe_type(self, val):
        self.write_16(0x08, (int)(val*100))
        
    def read_probe_type(self):
        return self.read_16(0x08)/100.0
        
    def read_calibration_data(self):
        return self.read_32(0x0A)/100.0

    def write_calibration_data(self, val):
        self.write_32(0x0A, (int)(val*100))

    def write_calibration_request(self, val):
        self.write_byte(0x0E, val)
        
    def read_calibration_confirm(self):
        return self.read_byte(0x0F)

    def read_temperature_compensation(self):
        return self.read_32(0x10)/100.0

    def write_temperature_compensation(self, val):
        self.write_32(0x10, (int)(val*100))
    
    def read_temperature_confirmation(self):
        return self.read_32(0x14)/100.0
        
    def read_EC_reading(self):
        return self.read_32(0x018)/100.0
        
    def read_TDS_reading(self):
        return self.read_32(0x01C)/100.0  

    def read_salinitiy_reading(self):
        return self.read_32(0x020)/100.0
        