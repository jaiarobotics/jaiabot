#!/usr/bin/env python3

import argparse
from flask import *
import simplejson as json
import logging
import os
import sys


import pyjaia.contours
import pyjaia.drift_interpolation
import pyjaia.utils

from pathlib import *
import traceback

# Jaia packages
from pyjaia import jaialog_store
from pyjaia.jaialog_store import moos_messages

import usb_offload


l = logging.getLogger(os.path.basename(__file__))


# Parsing the arguments
def parseFilenames(input: str):
    '''Parses a comma-delimited set of filenames'''
    if input is None:
        return None
    else:
        return input.split(',')

def validateLogNames(logNames: list[str]):
    '''Raises a ValueError if any of these log names could refer to a file outside the log directory'''
    for logName in logNames:
        if not logName or '/' in logName or '\\' in logName or logName.startswith('.') or '..' in logName:
            raise ValueError(f'Invalid log name: {logName!r}')

####### Responses

def JSONResponse(obj):
    return Response(json.dumps(obj, ignore_nan=True), mimetype='application/json')

def JSONErrorResponse(msg):
    obj = {"error": msg}
    l.error(msg)
    return JSONResponse(obj)

# The flask app

app = Flask(__name__)

"""Error handling:  if an exception occurs during any of these requests, return a JSON error response"""
@app.errorhandler(Exception)
def handle_http_exception(e):
    l.error(f'Exception: {traceback.format_exc()}')
    _, _, tb = sys.exc_info()
    return JSONErrorResponse(f"There was an error processing your request.  Please check the server logs for details.\n{e}\n{traceback.extract_tb(tb)[-1].filename} line {traceback.extract_tb(tb)[-1].lineno}")

@app.route('/jdv/<path>', methods=['GET'])
def getStaticFile(path):
    try:
        return send_from_directory(root, path)
    except Exception as e:
        l.error(e)
        l.error(locals())
        return Response(status=404)

@app.route('/jdv/', methods=['GET'])
def getRoot():
    '''The html/css/javascript client'''
    return getStaticFile('index.html')

@app.route('/')
def index():
    return redirect('/jdv/')

####### API endpoints

@app.route('/jdv/logs', methods=['GET'])
def getLogs():
    return JSONResponse(jaialogStore.getLogs().to_dict())

@app.route('/jdv/convert-if-needed', methods=['POST'])
def convertLogs():
    log_names = request.json
    return JSONResponse(jaialogStore.convertIfNeeded(log_names))

@app.route('/jdv/copy-to-usb', methods=['POST'])
def copyLogsToUSB():
    '''Start copying a list of logs to the USB drive plugged into the hub'''
    log_names = request.json
    validateLogNames(log_names)
    return JSONResponse(usbOffloadManager.addLogNames(log_names).to_dict())

@app.route('/jdv/copy-to-usb', methods=['GET'])
def getCopyToUSBStatus():
    '''Get the progress of the current (or most recent) copy to a USB drive'''
    return JSONResponse(usbOffloadManager.getStatus().to_dict())

@app.route('/jdv/log/<logName>', methods=['DELETE'])
def deleteLog(logName: str):
    return JSONResponse(jaialogStore.deleteLog(logName))

@app.route('/jdv/paths', methods=['GET'])
def getFields():
    log_names = parseFilenames(request.args.get('log'))
    root_path = request.args.get('root_path')
    return JSONResponse(jaialogStore.getFields(log_names, root_path))


@app.route('/jdv/all-series-descriptors', methods=['GET'])
def getAllSeriesDescriptors():
    log_names = parseFilenames(request.args.get('log'))
    return JSONResponse([series.to_dict() for series in jaialogStore.getAllSeriesDescriptors(log_names)])


@app.route('/jdv/series', methods=['GET'])
def getSeries():
    log_names = parseFilenames(request.args.get('log'))
    series_names = request.args.get('path').split(',')
    series = jaialogStore.getSeries(log_names, series_names)
    return JSONResponse(series)

@app.route('/jdv/objects', methods=['GET'])
def getObjects():
    log_names = parseFilenames(request.args.get('log'))
    path = request.args.get('path')
    assert path is not None, "Missing path parameter"
    try:
        return JSONResponse(jaialogStore.getObjects(log_names, path))
    except KeyError:
        return JSONResponse([])


@app.route('/jdv/map', methods=['GET'])
def getMap():
    log_names = parseFilenames(request.args.get('log'))
    return JSONResponse(jaialogStore.getMap(log_names))


@app.route('/jdv/commands', methods=['GET'])
def getCommands():
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogStore.getCommands(log_names))


@app.route('/jdv/active-goal', methods=['GET'])
def getActiveGoals():
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogStore.getActiveGoals(log_names))


@app.route('/jdv/task-packet', methods=['GET'])
def getTaskPackets():
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogStore.getTaskPacketDicts(log_names))


@app.route('/jdv/moos', methods=['GET'])
def getMOOSMessages():
    '''Get a CSV of all the MOOSMessage objects between t_start and t_end from the logs'''
    log_names = parseFilenames(request.args.get('log'))
    t_start = int(request.args.get('t_start'))
    t_end = int(request.args.get('t_end'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return Response(moos_messages.get_moos_messages(log_names, t_start, t_end), mimetype='text/csv')


@app.route('/jdv/depth-contours', methods=['GET'])
def getDepthContours():
    """Get a GeoJSON of contours for the depth soundings in this mission

    Returns:
        Response: A response containing the GeoJSON for the current depth contours.
    """
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    taskPackets = jaialogStore.getTaskPacketDicts(log_names)
    return JSONResponse(pyjaia.contours.taskPacketsToColorMap(taskPackets))


@app.route('/jdv/interpolated-drifts', methods=['GET'])
def getInterpolatedDrifts():
    '''Get a GeoJSON of interpolated drift icons'''
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    taskPackets = jaialogStore.getTaskPacketDicts(log_names)
    return Response(pyjaia.drift_interpolation.taskPacketsToDriftMarkersGeoJSON(taskPackets))


@app.route('/jdv/h5', methods=['GET'])
def getH5():
    '''Download a Jaia HDF5 file'''
    logName = request.args.get('file')

    if logName is None:
        return JSONErrorResponse('Please specify file to download with "file="')
    
    h5_name = logName + '.h5'
    headers = { 'Content-Disposition': f'attachment; filename={h5_name}' }

    return Response(jaialogStore.getH5File(logName), mimetype='application/x-hdf', headers=headers)


@app.route('/jdv/ubx', methods=['GET'])
def getUBX():
    '''Download a UBX file'''
    logName = request.args.get('file')

    if logName is None:
        return JSONErrorResponse('Please specify file to download with "file="')
    
    logNames = parseFilenames(logName)
    fileDownload = jaialogStore.getUBXFile(logNames)
           
    headers = { 'Content-Disposition': f'attachment; filename={fileDownload.filename}' }
    return Response(fileDownload.content, mimetype=fileDownload.mimetype, headers=headers)


if __name__ == '__main__':

    # Arguments
    parser = argparse.ArgumentParser()
    parser.add_argument("-p", dest='port', type=int, default=40010, help="Port to serve the jaiabot_data_vision interface")
    parser.add_argument("-d", dest="directory", type=str, default="/var/log/jaiabot/bot_offload", help="Path to find the goby / h5 files")
    parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
    parser.add_argument("-a", dest="appRoot", type=str, default="../../../../build/web_dev/jdv", help="Location from which to serve web app")
    args = parser.parse_args()

    # Setup logging module
    logLevel = logging.getLevelName(args.logLevel.upper())
    print(f'==> Logging level: {args.logLevel.upper()}')
    l.setLevel(logLevel)
    logging.getLogger('werkzeug').setLevel('WARN')

    ####### Static files
    global root
    root = args.appRoot

    # Setup the directory
    jaialogStore = jaialog_store.JaialogStore(args.directory)
    usbOffloadManager = usb_offload.UsbOffloadManager(args.directory)

    # Print the URL for browser access
    l.info(f'Jaiabot Logs directory:           {os.path.abspath(args.directory)}')
    l.info(f'Application root directory:       {os.path.abspath(args.appRoot)}')
    l.info(f'Serving to:                       http://{pyjaia.utils.myip()}:{args.port}/')

    app.run(host='0::0', port=args.port, debug=True)
