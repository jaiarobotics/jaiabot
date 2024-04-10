import h5py
from pyjaia.series import *
from copy import *
from datetime import timedelta
from pyjaia.h5_tools import *


class SeriesSet:
    """All of the series that are relevant to calculating significant wave heights.
    """

    def __init__(self):
        self.missionState = Series()
        self.acc_x = Series()
        self.acc_y = Series()
        self.acc_z = Series()
        
        self.grav_x = Series()
        self.grav_y = Series()
        self.grav_z = Series()

        self.accelerationVertical = Series()


    @staticmethod
    def loadFromH5File(h5File: h5py.File):
        """Reads a SeriesSet from an h5 file.

        Args:
            h5File (h5py.File): The h5 file.

        Returns:
            SeriesSet: The SeriesSet representing the entire file.
        """
        seriesSet = SeriesSet()

        # Get the full series
        seriesSet.missionState = Series.loadFromH5File(h5File, 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/mission_state')
        
        seriesSet.acc_x = Series.loadFromH5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/x', invalid_values=[None], name='acc.x')
        seriesSet.acc_y = Series.loadFromH5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/y', invalid_values=[None], name='acc.y')
        seriesSet.acc_z = Series.loadFromH5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/z', invalid_values=[None], name='acc.z')

        seriesSet.grav_x = Series.loadFromH5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/x', invalid_values=[None], name='grav.x')
        seriesSet.grav_y = Series.loadFromH5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/y', invalid_values=[None], name='grav.y')
        seriesSet.grav_z = Series.loadFromH5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/z', invalid_values=[None], name='grav.z')

        seriesSet.accelerationVertical = Series()
        seriesSet.accelerationVertical.name = 'Vertical Accel'
        seriesSet.accelerationVertical.utime = copy(seriesSet.acc_x.utime)
        for i in range(len(seriesSet.acc_x.utime)):
            seriesSet.accelerationVertical.y_values.append((seriesSet.acc_x.y_values[i] * seriesSet.grav_x.y_values[i] + 
                                                seriesSet.acc_y.y_values[i] * seriesSet.grav_y.y_values[i] + 
                                                seriesSet.acc_z.y_values[i] * seriesSet.grav_z.y_values[i]) / 9.8)
        
        return seriesSet


    def slice(self, timeRange: TimeRange):
        subSeriesSet = SeriesSet()

        subSeriesSet.missionState = self.missionState.slice(timeRange)
        subSeriesSet.acc_x = self.acc_x.slice(timeRange)
        subSeriesSet.acc_y = self.acc_y.slice(timeRange)
        subSeriesSet.acc_z = self.acc_z.slice(timeRange)
        
        subSeriesSet.grav_x = self.grav_x.slice(timeRange)
        subSeriesSet.grav_y = self.grav_y.slice(timeRange)
        subSeriesSet.grav_z = self.grav_z.slice(timeRange)

        subSeriesSet.accelerationVertical = self.accelerationVertical.slice(timeRange)

        return subSeriesSet


    def split(self, shouldInclude: Callable[[int, "SeriesSet"], bool]):
        timeRanges: List[TimeRange] = []
        timeRange: TimeRange = None

        for index, utime in enumerate(self.missionState.utime):
            if shouldInclude(index, self):
                if timeRange is None:
                    timeRange = TimeRange(utime, None)
            else:
                if timeRange is not None:
                    timeRange.end = utime
                    timeRanges.append(timeRange)
                    timeRange = None

        # The whole thing is included
        if timeRange is not None and timeRange.end is None:
            return [self]
    
        return [self.slice(timeRange) for timeRange in timeRanges]


def isInDriftState(missionStateIndex: int, seriesSet: "SeriesSet"):
    """Returns true if this data point is in a DRIFT state.

    Args:
        missionStateIndex (int): Index into the missionState Series.
        seriesSet (SeriesSet): The series set to check.

    Returns:
        bool: Return true if the bot is drifting at this point in the SeriesSet.
    """

    DRIFT = 121
    if seriesSet.missionState.y_values[missionStateIndex] != DRIFT:
        # Not in a DRIFT state
        return False
    
    return True
