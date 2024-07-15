#!/usr/bin/env python3

import argparse
from flask import *
import simplejson as json
import logging
import os
import math

import jaialog_store
import moos_messages
import pyjaia.contours
import pyjaia.drift_interpolation

from pathlib import *


# Parsing the arguments
def parseFilenames(input: str):
    '''Parses a comma-delimited set of filenames'''
    if input is None:
        return None
    else:
        return input.split(',')

####### Responses

def JSONResponse(obj):
    return Response(json.dumps(obj, ignore_nan=True), mimetype='application/json')

def JSONErrorResponse(msg):
    obj = {"error": msg}
    return JSONResponse(obj)

# The flask app

app = Flask(__name__)

@app.route('/<path>', methods=['GET'])
def getStaticFile(path):
    return send_from_directory(root, path)

@app.route('/', methods=['GET'])
def getRoot():
    '''The html/css/javascript client'''
    return getStaticFile('index.html')

####### API endpoints

@app.route('/logs', methods=['GET'])
def getLogs():
    return JSONResponse(jaialogStore.getLogs().to_dict())

@app.route('/convert-if-needed', methods=['POST'])
def convertLogs():
    log_names = request.json
    return JSONResponse(jaialogStore.convertIfNeeded(log_names))

@app.route('/log/<logName>', methods=['DELETE'])
def deleteLog(logName: str):
    return JSONResponse(jaialogStore.deleteLog(logName))

@app.route('/paths', methods=['GET'])
def getFields():
    log_names = parseFilenames(request.args.get('log'))
    root_path = request.args.get('root_path')
    return JSONResponse(jaialogStore.getFields(log_names, root_path))

@app.route('/series', methods=['GET'])
def getSeries():
    log_names = parseFilenames(request.args.get('log'))
    series_names = request.args.get('path')

    try:
        series = jaialogStore.getSeries(log_names, series_names)
        return JSONResponse(series)
    except Exception as e:
        return JSONErrorResponse(str(e))

@app.route('/map', methods=['GET'])
def getMap():
    log_names = parseFilenames(request.args.get('log'))
    return JSONResponse(jaialogStore.getMap(log_names))


@app.route('/commands', methods=['GET'])
def getCommands():
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogStore.getCommands(log_names))


@app.route('/active-goal', methods=['GET'])
def getActiveGoals():
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogStore.getActiveGoals(log_names))


@app.route('/task-packet', methods=['GET'])
def getTaskPackets():
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogStore.getTaskPacketDicts(log_names))


@app.route('/moos', methods=['GET'])
def getMOOSMessages():
    '''Get a CSV of all the MOOSMessage objects between t_start and t_end from the logs'''
    log_names = parseFilenames(request.args.get('log'))
    t_start = int(request.args.get('t_start'))
    t_end = int(request.args.get('t_end'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return Response(moos_messages.get_moos_messages(log_names, t_start, t_end), mimetype='text/csv')


@app.route('/depth-contours', methods=['GET'])
def getDepthContours():
    '''Get a GeoJSON of contours for the depth soundings in this mission'''
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    taskPackets = jaialogStore.getTaskPacketDicts(log_names)
    return JSONResponse(pyjaia.contours.taskPacketsToColorMap(taskPackets))


@app.route('/interpolated-drifts', methods=['GET'])
def getInterpolatedDrifts():
    '''Get a GeoJSON of interpolated drift icons'''
    log_names = parseFilenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    taskPackets = jaialogStore.getTaskPacketDicts(log_names)
    return Response(pyjaia.drift_interpolation.taskPacketsToDriftMarkersGeoJSON(taskPackets))


@app.route('/h5', methods=['GET'])
def getH5():
    '''Download a Jaia HDF5 file'''
    logName = request.args.get('file')

    if logName is None:
        return JSONErrorResponse('Please specify file to download with "file="')
    
    h5_name = logName + '.h5'
    headers = { 'Content-Disposition': f'attachment; filename={h5_name}' }

    return Response(jaialogStore.getH5File(logName), mimetype='application/x-hdf', headers=headers)


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
    logging.getLogger('root').setLevel(logLevel)
    logging.getLogger('werkzeug').setLevel('WARN')

    ####### Static files
    global root
    root = args.appRoot

    # Setup the directory
    jaialogStore = jaialog_store.JaialogStore(args.directory)

    # Print the URL for browser access
    logging.info(f'Jaiabot Logs directory:           {os.path.abspath(args.directory)}')
    logging.info(f'Application root directory:       {os.path.abspath(args.appRoot)}')
    logging.info(f'Serving to:                       http://{pyjaia.utils.myip()}:{args.port}/')

    app.run(host='0::0', port=args.port, debug=True)
