#!/usr/bin/env python3

import h5py
import objects
import argparse

from pprint import *
from datetime import *


parser = argparse.ArgumentParser(description='Lists all error messages from a JaiaH5 file')
parser.add_argument('jaiah5_path')
args = parser.parse_args()


jaia_h5 = h5py.File(args.jaiah5_path)

processHealthGroup = jaia_h5['goby::health::response/goby.middleware.protobuf.ProcessHealth']
processHealthList = objects.jaialog_get_object_list(processHealthGroup, repeated_members=['child'])


# vehicleHealthGroup = jaia_h5['goby::health::report/goby.middleware.protobuf.VehicleHealth']
# vehicleHealthList = objects.jaialog_get_object_list(vehicleHealthGroup, repeated_members=['process', 'child'])

for processHealth in processHealthList:
    
    def getThreadErrorMessages(thread):
        errors = []
        warnings = []

        health = thread['jaiabot.protobuf.jaiabot_thread']

        for error in health['error']:
            if error < 10000:
                errors.append(error)
        
        for warning in health['warning']:
            if warning < 10000:
                warnings.append(warning)

        for child in thread['child']:
            childErrors, childWarnings = getThreadErrorMessages(child)
            errors.extend(childErrors)
            warnings.extend(childWarnings)

        return errors, warnings

    errors, warnings = getThreadErrorMessages(processHealth['main'])

    if processHealth['main']['state'] != 'HEALTH__OK' or len(errors) > 0 or len(warnings) > 0:

        _utime_ = processHealth['_utime_']
        d = datetime.fromtimestamp(_utime_ / 1e6)

        state = processHealth["main"]["state"]

        print (f'{d.isoformat(" ")}  {processHealth["name"]}  {state}  errors: {errors}  warnings: {warnings}')

