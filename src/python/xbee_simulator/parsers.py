#!/usr/bin/env python3

from digi.xbee.models.atcomm import ATStringCommand, ATCommand

class ATCommandParser:
    def __init__(self):
        self.command_mode = False
        self._seperator = b' '
        self._delimiter = b'\r'

    def parse(self, buffer):
        if not self.command_mode and buffer.endswith(b'+++'):
            self.command_mode = True
            return "OK"
        elif self.command_mode and buffer.endswith(self._delimiter):
            at_cmd = self.extract_at_cmd(buffer)
            return None
        else:
            return None
        
    def extract_at_cmd(self, buffer):
        try:
            at_idx = buffer.rindex(b'AT') + 2
            end_idx = buffer.index(b'\r', at_idx)
            at_cmd_raw = buffer[at_idx:end_idx]
        except ValueError:
            return None
        at_cmd_bytes = at_cmd_raw.split(self._seperator)
        if len(at_cmd_bytes) == 1:
            at_cmd = at_cmd_bytes[0].decode('utf8')
            at_param = None
        elif len(at_cmd_bytes) == 2:
            at_cmd = at_cmd_bytes[0].decode('utf8')
            at_param = at_cmd_bytes[1].decode('utf8')
        else:
            return None
        
        if len(at_cmd) > 2:
            return None
        
        if at_cmd in ATStringCommand.__members__:
            print("VALID")
            command = ATCommand(at_cmd, at_param)
            print(command)
        else:
            print("INVALID")
            return None

        print(at_cmd, at_param)