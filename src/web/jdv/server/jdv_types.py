from typing import *
from dataclasses import *


@dataclass
class JDVTaskPacket:
    logFilename: str
    taskPacket: Dict


@dataclass
class JDVTaskPacketResponse:
    taskPackets: List[JDVTaskPacket]
