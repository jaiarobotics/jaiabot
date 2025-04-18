from datetime import *
from dataclasses import *


UnixTimeMicroseconds = int

@dataclass
class TimeRange:
    start: UnixTimeMicroseconds
    end: UnixTimeMicroseconds

    def duration(self):
        return timedelta(microseconds=(self.end - self.start))
    
    @staticmethod
    def fromDatetimes(start: datetime, end: datetime):
        return TimeRange(start.timestamp() * 1e6, end.timestamp() * 1e6)

    def __contains__(self, time: UnixTimeMicroseconds):
        return time > self.start and time < self.end
