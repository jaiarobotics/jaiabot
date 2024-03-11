import h5py
from pyjaia.series import *
from copy import *
from datetime import timedelta
from pyjaia.h5_tools import *


class SeriesSet:
    def __init__(self):
        self.missionState = Series()
        self.altitude = Series()
        self.acc_x = Series()
        self.acc_y = Series()
        self.acc_z = Series()
        
        self.grav_x = Series()
        self.grav_y = Series()
        self.grav_z = Series()

        self.accelerationVertical = Series()

        self.seriesNames = [
            'missionState', 'altitude', 'acc_x', 'acc_y', 'acc_z', 'grav_x', 'grav_y', 'grav_z', 'accelerationVertical'
        ]


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
        seriesSet.altitude = Series.loadFromH5File(h5File, 'goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/altitude', invalid_values=[None])
        
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
        subSeriesSet.altitude = self.altitude.slice(timeRange)
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
