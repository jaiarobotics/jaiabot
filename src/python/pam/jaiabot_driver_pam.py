#!/usr/bin/env python3
import logging
import sys

import goby
from jaiabot_driver_pam_goby import SingleThreadApplication, groups
from jaiabot.messages.pam_pb2 import PamData, PamCommand
from pam import Pam, PamSimulator

log = logging.getLogger('jaiabot_driver_pam')


class JaiabotDriverPam(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=self.cfg.status_frequency)
        goby.glog.install()

        self._pam = PamSimulator() if self.cfg.simulate else Pam(self.cfg.serial_device)
        self._responding = True

        self.interprocess().subscribe(groups.pam, PamCommand, self._on_command)

    def _on_command(self, command: PamCommand) -> None:
        log.debug(f'received command: {command}')
        if command.type == PamCommand.CMD_STATUS:
            self._publish_state()
        elif command.type == PamCommand.CMD_START:
            self._pam.startDevice()
        elif command.type == PamCommand.CMD_STOP:
            self._pam.stopDevice()

    def _publish_state(self):
        try:
            pam_state = self._pam.getState()
        except Exception as e:
            self._responding = False
            log.warning(f'could not read PAM state: {e}')
            return

        if pam_state is None:
            self._responding = False
            log.warning('PAM state is None')
            return

        self._responding = True
        log.debug(f'state: {pam_state}')
        self.interprocess().publish(groups.pam, PamData(pam_state=pam_state))

    def loop(self):
        self._publish_state()

    def health(self, health):
        from goby.middleware.protobuf import coroner_pb2
        if not self._responding:
            health.state = coroner_pb2.HEALTH__FAILED


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotDriverPam))
