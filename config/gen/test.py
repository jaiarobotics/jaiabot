jaiabot_apps = []

jaiabot_apps_imu = [
    {'exe': 'jaiabot_adafruit_BNO055_driver',
    'description': 'JaiaBot BNO055 IMU Sensor Driver',
    'template': 'goby-app.service.in',
    'error_on_fail': 'ERROR__FAILED__JAIABOT_ADAFRUIT_BNO055_DRIVER',
    'runs_on': 'bot',
    'wanted_by': 'jaiabot_health.service'},
    {'exe': 'jaiabot_imu.py',
    'description': 'JaiaBot BNO055 IMU Python Driver Secondary',
    'template': 'py-app.service.in',
    'subdir': 'imu',
    'args': f'-t bno085 -p 20010 -d -o second',
    'error_on_fail': 'ERROR__FAILED__PYTHON_JAIABOT_IMU',
    'runs_on': 'bot',
    'runs_when': 'runtime',
    'wanted_by': 'jaiabot_health.service',
    'restart': 'on-failure'},
]

jaiabot_apps.extend(jaiabot_apps_imu)

for app in jaiabot_apps:
    if app['exe'] == 'jaiabot_imu.py' and 'second' in app['args']:
        print('jaiabot_imu_py_secondary')