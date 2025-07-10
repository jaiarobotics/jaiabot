#!/usr/bin/env python3

import logging

from digi.xbee.packets.common import ReceivePacket
from digi.xbee.models.mode import OperatingMode
from digi.xbee.models.address import XBee16BitAddress, XBee64BitAddress

class SimXBeeNetwork:
    def __new__(cls):
        if not hasattr(cls, '_instance'):
            cls._instance = super(SimXBeeNetwork, cls).__new__(cls)
            cls._instance.xbees = []
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        self.logger = logging.getLogger()  

        self.logger.info('SXBN (Simulated XBee Network) initialized.')
        self._initialized = True

        self._xbee_addresses = []       

    def register(self, xbee):
        self.xbees.append(xbee)
        self._refresh_stats()
        self.logger.info(f'SXBN registered new XBee {xbee.name}.')
        self.logger.debug(f'SXBN address list: {self._xbee_addresses}.')

    def _refresh_stats(self):
        self._xbee_addresses = []
        for xbee in self.xbees:
            self._xbee_addresses.append(xbee._user_serial)

    def send(self, sender, packet):
        dest_addr = packet.x64bit_dest_addr
        rf_data = packet.rf_data
        xbee_matched = False
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
                self.logger.debug(f'SXBN sending data from {sender.name} to {xbee.name}.')
                xbee.receive(rxpkt)
                xbee_matched = True
        if not xbee_matched:
            self.logger.debug(f'SXBN sending data from {sender.name} to non-existent address: {str(dest_addr)}.')
            self._refresh_stats()
            self.logger.debug(f'SXBN address list: {self._xbee_addresses}.')