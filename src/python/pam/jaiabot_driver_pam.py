#!/usr/bin/env python3
import logging
import sys

import goby
from jaiabot_driver_pam_goby import SingleThreadApplication, groups
from jaiabot.messages.pam_pb2 import PamData, PamCommand
from pam import (EpPam, LegacyPam, PamSimulator, PamStackType, PAM_DETECT_TIMEOUT_SEC,
                 detect_pam_stack_type)

log = logging.getLogger('jaiabot_driver_pam')


class JaiabotDriverPam(SingleThreadApplication):
    def __init__(self):
        super().__init__(loop_frequency_hertz=self.cfg.status_frequency)
        goby.glog.install()

        self._pam = PamSimulator() if self.cfg.simulate else self._detect_pam()
        self._responding = True

        self.interprocess().subscribe(groups.pam, PamCommand, self._on_command)

    def _detect_pam(self):
        connection_type = self.cfg.connection_type
        log.info(f'Waiting up to {PAM_DETECT_TIMEOUT_SEC}s to detect the PAM stack type')
        pam_stack_type = detect_pam_stack_type(connection_type)
        if pam_stack_type is None:
            log.error('No PAM recorder enumerated over USB')
            sys.exit(1)

        log.info(f'Detected {pam_stack_type.value} PAM stack')
        if pam_stack_type == PamStackType.EP:
            return EpPam()
        return LegacyPam(connection_type)

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
        from jaiabot.messages import health_pb2

        if not self._responding:
            health.state = coroner_pb2.HEALTH__DEGRADED
            health.Extensions[health_pb2.jaiabot_thread].warning.append(
                health_pb2.WARNING__NOT_RESPONDING__JAIABOT_PAM_DRIVER)


if __name__ == '__main__':
    sys.exit(goby.run(JaiabotDriverPam))
