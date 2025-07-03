#!/usr/bin/env python3

from digi.xbee.packets.common import ReceivePacket
from digi.xbee.models.mode import OperatingMode
from digi.xbee.models.address import XBee16BitAddress, XBee64BitAddress

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

    def send(self, sender, packet):
        dest_addr = packet.x64bit_dest_addr
        rf_data = packet.rf_data
        for xbee in self.xbees:
            rxpkt = None
            if xbee.matches(sender._network_id,
                            sender._preamble_id,
                            str(dest_addr)):
                if rxpkt is None:
                    rxpkt = ReceivePacket(
                        x64bit_addr=XBee64BitAddress(bytearray.fromhex(sender._user_serial)),
                        x16bit_addr=XBee16BitAddress(bytearray.fromhex('FFFE')),
                        rx_options=0x00,
                        rf_data=rf_data,
                        op_mode=OperatingMode.API_MODE
                    )
                print(f'[SXBN] Sending data')
                xbee.receive(rxpkt)

