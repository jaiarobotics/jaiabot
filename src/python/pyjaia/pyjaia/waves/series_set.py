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

        seriesSet.calculateVerticalAccelerations()
        
        return seriesSet


    def calculateVerticalAccelerations(self):
        self.accelerationVertical = Series()
        self.accelerationVertical.name = 'Vertical Accel'
        self.accelerationVertical.utime = copy(self.acc_x.utime)
        for i in range(len(self.acc_x.utime)):
            self.accelerationVertical.y_values.append((self.acc_x.y_values[i] * self.grav_x.y_values[i] + 
                                                self.acc_y.y_values[i] * self.grav_y.y_values[i] + 
                                                self.acc_z.y_values[i] * self.grav_z.y_values[i]) / 9.8)


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
    

    def filterGlitches(self):
        """The Adafruit BNO055 IMU has certain glitches that should be filtered out. This method will filter them out in-place.
        """

        ax, ay, az = self.acc_x, self.acc_y, self.acc_z
        gx, gy, gz = self.grav_x, self.grav_y, self.grav_z

        rax = ax.cleared()
        ray = ay.cleared()
        raz = az.cleared()

        rgx = gx.cleared()
        rgy = gy.cleared()
        rgz = gz.cleared()

        for i in range(len(ax.y_values)):
            g = [gx.y_values[i], gy.y_values[i], gz.y_values[i]]
            a = [ax.y_values[i], ay.y_values[i], az.y_values[i]]

            g_mag_squared = g[0] * g[0] + \
                            g[1] * g[1] + \
                            g[2] * g[2] 
            
            if g_mag_squared < (8 * 8) or g_mag_squared > (50 * 50):
                continue

            a_mag_squared = a[0] * a[0] + \
                        a[1] * a[1] + \
                        a[2] * a[2]

            if a_mag_squared == 0 or a_mag_squared > (50 * 50):
                continue

            if abs(g[0]) < 0.02 or abs(g[1]) < 0.02 or abs(g[2]) < 0.02: # Sometimes the gravity components glitch out to 0.01 for no reason
                continue

            rax.appendPair(ax.get(i))
            ray.appendPair(ay.get(i))
            raz.appendPair(az.get(i))

            rgx.appendPair(gx.get(i))
            rgy.appendPair(gy.get(i))
            rgz.appendPair(gz.get(i))

        def filterAcc(series: Series):
            """Filter out miscellanous glitches that are common in the BNO055 data.

            Args:
                series (Series): Unfiltered acceleration series from the BNO055.

            Returns:
                _type_: Filtered acceleration series, with glitches removed as best we can.
            """
            newSeries = deepcopy(series)
            newSeries.name = f'Filtered {series.name}'
            newSeries.y_values = list(newSeries.y_values) # In case it's a tuple
            Y = newSeries.y_values
            t = newSeries.utime

            ERR = 0.2
            ERR_LINEAR_EXTRAPOLATION = 0.64

            for i in range(2, len(Y) - 2 - 1):
                y = Y[i]

                average_y = (Y[i-1] + Y[i+1]) / 2
                if abs(y - average_y) < ERR:
                    continue

                y_linear_extrapolation = Y[i-1] + (t[i] - t[i-1]) * (Y[i-1] - Y[i-2]) / (t[i-1] - t[i-2])

                if abs(y - y_linear_extrapolation) < ERR_LINEAR_EXTRAPOLATION:
                    continue

                y_corrections = [-1.28, +1.28]

                for y_correction in y_corrections:
                    y_corrected = y + y_correction

                    if abs(y_corrected - average_y) < ERR:
                        Y[i] = y_corrected
                        print('glitch')
                        break

                    if abs(y_corrected - Y[i-1]) < ERR and abs(y_corrected - (Y[i+1] + y_correction)) < ERR:
                        Y[i] = y_corrected
                        print('glitch')
                        break
                
            return newSeries

        self.acc_x, self.acc_y, self.acc_z = filterAcc(rax), filterAcc(ray), filterAcc(raz)
        self.grav_x, self.grav_y, self.grav_z = rgx, rgy, rgz

        self.calculateVerticalAccelerations()


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
