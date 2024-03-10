import h5py
from series import *
from copy import *
from datetime import timedelta
from jaia_h5 import *
from pyjaia.h5_tools import *


def _readSeries(log: h5py.File, path: str, invalid_values: set=set(), name: str=None, scheme=1):
    series = Series()

    # Strip initial '/' character
    if path is not None and path[0] == '/' and len(path) > 1:
        path = path[1:]

    if name is not None:
        series.name = name
    elif path is not None:
        series.name = path.split('/')[-1]
    else:
        series.name = ''

    series.utime = []
    series.y_values = []
    series.hovertext = {}

    if log:
        try:
            _utime__array = log[get_root_item_path(path, '_utime_')]
            _scheme__array = log[get_root_item_path(path, '_scheme_')]
            path_array = log[path]

            data = zip(h5_get_series(_utime__array), h5_get_series(_scheme__array), h5_get_series(path_array))
            data = filter(lambda pt: pt[1] == scheme and pt[2] not in invalid_values, data)

            series.utime, schemes, series.y_values = zip(*data)
        except (ValueError, KeyError):
            logging.warning(f'No valid data found for log: {log.filename}, series path: {path}')
            series.utime = []
            series.schemes = []
            series.y_values = []
            series.hovertext = {}

            return series

        series.hovertext = h5_get_hovertext(log[path]) or {}

    return series


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
    def fromH5File(h5File: h5py.File):
        """Reads a SeriesSet from an h5 file.

        Args:
            h5File (h5py.File): The h5 file.

        Returns:
            SeriesSet: The SeriesSet representing the entire file.
        """
        seriesSet = SeriesSet()

        # Get the full series
        seriesSet.missionState = _readSeries(h5File, 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/mission_state')
        seriesSet.altitude = _readSeries(h5File, 'goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/altitude', invalid_values=[None])
        
        seriesSet.acc_x = _readSeries(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/x', invalid_values=[None], name='acc.x')
        seriesSet.acc_y = _readSeries(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/y', invalid_values=[None], name='acc.y')
        seriesSet.acc_z = _readSeries(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/z', invalid_values=[None], name='acc.z')

        seriesSet.grav_x = _readSeries(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/x', invalid_values=[None], name='grav.x')
        seriesSet.grav_y = _readSeries(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/y', invalid_values=[None], name='grav.y')
        seriesSet.grav_z = _readSeries(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/z', invalid_values=[None], name='grav.z')

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
