#!/usr/bin/env python3

import string
import os



service_string = string.Template(open('gps_i2c_pipe.service').read()).substitute(dir=os.getcwd())

open('/etc/systemd/system/gps_i2c_pipe.service', 'w').write(service_string)

os.system('rm /etc/apparmor.d/usr.sbin.gpsd')

os.system('systemctl enable gps_i2c_pipe')
os.system('systemctl restart gps_i2c_pipe')
