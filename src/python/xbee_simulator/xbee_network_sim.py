#!/usr/bin/env python3

class SimXBeeNetwork:
    def __new__(cls):
        if not hasattr(cls, 'instance'):
            cls.instance = super(SimXBeeNetwork, cls).__new__(cls)
            cls.instance.xbees = []
            print('[SXBN] Simulated XBee Network Initialized')
        return cls.instance

    def register(self, xbee):
        self.xbees.append(xbee)
        print(f'[SXBN] Registered XBee {xbee.name}')

    def send(self, sender, addr, data):
        for xbee in self.xbees:
            if xbee.matches(sender._network_id,
                            sender._preamble_id,
                            str(addr)):
                print(f'[SXBN] Sending data')
                xbee.receive(data, sender._user_serial)

