#!/usr/bin/env python3
import logging
import sys

import goby
from jaiabot_ppk_logger_goby import SingleThreadApplication, groups
from jaiabot.messages.ppk_pb2 import UBXChunk
from ubx import GPSDClient, GPSDClientSimulator

log = logging.getLogger('jaiabot_ppk_logger')

# GPSD is drained faster than it fills, so a chunk never waits long to be published
DRAIN_FREQUENCY_HERTZ = 20


class JaiabotPPKLogger(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=DRAIN_FREQUENCY_HERTZ)
        goby.glog.install()

        if self.cfg.input_file:
            self._client = GPSDClientSimulator(self.cfg.input_file)
        else:
            self._client = GPSDClient(self.cfg.gpsd_host, self.cfg.gpsd_port)

        self._output_file = open(self.cfg.output_file, 'wb') if self.cfg.output_file else None
        self._connected = True

    def loop(self):
        try:
            messages = self._client.read_messages()
        except EOFError:
            log.info('end of input reached')
            self.quit()
            return
        except Exception as e:
            self._connected = False
            log.error(f'GPSD read failed: {e}')
            self.quit(1)
            return

        for message in messages:
            log.debug(f'UBX message of length {len(message)}: {message[:4].hex()}')
            if self._output_file:
                self._output_file.write(message)
                self._output_file.flush()
            self.interprocess().publish(groups.ppk, UBXChunk(data=message))

    def health(self, health):
        from goby.middleware.protobuf import coroner_pb2
        if not self._connected:
            health.state = coroner_pb2.HEALTH__FAILED


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotPPKLogger))
