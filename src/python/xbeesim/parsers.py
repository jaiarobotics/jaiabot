#!/usr/bin/env python3

class CommandParser:
    def __init__(self, parsedict=None):
        self.command_mode = False

    def parse(self, buffer):
        if buffer.endswith(b'+++') and not self.command_mode:
            self.command_mode = True
            return "OK"