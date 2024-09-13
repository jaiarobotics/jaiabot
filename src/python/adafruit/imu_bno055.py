from imu import *


class AdafruitBNO055(IMU):

    def __init__(self):
        self.is_setup = False

    def setup(self):
        if not self.is_setup:
            import adafruit_bno055
            import board

            self.i2c = board.I2C()

            try:
                self.sensor = adafruit_bno055.BNO055_I2C(self.i2c, address=0x28)
            except ValueError: # From I2CDevice if not on 0x28: ValueError("No I2C device at address: 0x%x" % self.device_address)
                self.sensor = adafruit_bno055.BNO055_I2C(self.i2c, address=0x29)
            
            self.sensor.mode = adafruit_bno055.NDOF_MODE
            self.is_setup = True

            # Remap the axes of the IMU to match the physical placement in the JaiaBot (P2 in section 3.4 of the datasheet)
            self.sensor.axis_remap = (0, 1, 2, 1, 1, 0)

    def takeReading(self):
        if not self.is_setup:
            self.setup()

        try:
            quaternion = self.sensor.quaternion
            euler = self.sensor.euler
            linear_acceleration = self.sensor.linear_acceleration
            gravity = self.sensor.gravity
            calibration_status = self.sensor.calibration_status
            angular_velocity = self.sensor.gyro
             
            if None in quaternion or None in euler or None in linear_acceleration or None in gravity or None  in calibration_status:
                return None
            
            # This is a very glitchy IMU, so we need to check for absurd values, and set those vectors to zero if we find them
            def filter(iterable: Iterable[float], threshold: float=50):
                for value in iterable:
                    if abs(value) > threshold:
                        return [0.0] * len(iterable)
                return iterable

            linear_acceleration = filter(linear_acceleration)
            gravity = filter(gravity)

            quaternion = Quaternion.from_tuple(quaternion)
            orientation = quaternion.to_euler_angles()
            orientation.heading = (orientation.heading + 90) % 360 # Even after consulting the docs, we're still off by 90 degrees!
            linear_acceleration = Vector3(*linear_acceleration)
            linear_acceleration_world = quaternion.apply(linear_acceleration)
            gravity = Vector3(*gravity)
            angular_velocity = Vector3(*angular_velocity)

            return IMUReading(orientation=orientation, 
                        linear_acceleration=linear_acceleration, 
                        linear_acceleration_world=linear_acceleration_world,
                        gravity=gravity,
                        accuracies=Accuracies(gyroscope=calibration_status[1], accelerometer=calibration_status[2], magnetometer=calibration_status[3]), # This comes as a tuple
                        calibration_state=CalibrationState.COMPLETE,
                        quaternion=quaternion,
                        angular_velocity=angular_velocity)

        except OSError as e:
            self.is_setup = False
            raise e
