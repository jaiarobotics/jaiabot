#!/usr/bin/env python3

import argparse
from flask import Flask, send_from_directory, Response, request
import json
import logging
import os

import jaialogs

# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("-p", dest='port', type=int, default=40010, help="Port to serve the jaiabotplot interface")
parser.add_argument("-d", dest="directory", type=str, default="/var/log/jaiabot/bot_offload", help="Path to find the goby / h5 files")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
args = parser.parse_args()

# Setup logging module
logLevel = getattr(logging, args.logLevel.upper())
logging.basicConfig(level=logLevel)
logging.getLogger('werkzeug').setLevel('WARN')

# Setup the directory
jaialogs.set_directory(os.path.expanduser(args.directory))

app = Flask(__name__)

# Parsing the arguments
def parse_log_filenames(input):
    if input is None:
        return None
    else:
        return input.split(',')

####### Responses

def JSONResponse(obj):
    return Response(json.dumps(obj), mimetype='application/json')

def JSONErrorResponse(msg):
    obj = {"error": msg}
    return JSONResponse(obj)

####### Static files
root = '../client/dist'

@app.route('/<path>', methods=['GET'])
def getStaticFile(path):
    return send_from_directory(root, path)

@app.route('/', methods=['GET'])
def getRoot():
    return getStaticFile('index.html')

####### API endpoints

@app.route('/logs', methods=['GET'])
def getLogs():
    return JSONResponse(jaialogs.get_logs())

@app.route('/paths', methods=['GET'])
def getFields():
    log_names = request.args.get('log')
    root_path = request.args.get('root_path')
    return JSONResponse(jaialogs.get_fields(log_names, root_path))

@app.route('/series', methods=['GET'])
def getSeries():
    log_names = request.args.get('log')
    series_names = request.args.get('path')

    try:
        series = jaialogs.get_series(log_names, series_names)
        return JSONResponse(series)
    except Exception as e:
        return JSONErrorResponse(str(e))

@app.route('/map', methods=['GET'])
def getMap():
    log_names = request.args.get('log')
    return JSONResponse(jaialogs.get_map(log_names))


@app.route('/commands', methods=['GET'])
def getCommands():
    log_names = parse_log_filenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogs.get_commands(log_names))


@app.route('/active_goal', methods=['GET'])
def getActiveGoals():
    log_names = parse_log_filenames(request.args.get('log'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogs.get_active_goals(log_names))


@app.route('/moos', methods=['GET'])
def getMOOSMessages():
    '''Get a list of all the MOOSMessage objects from the logs'''
    log_names = parse_log_filenames(request.args.get('log'))
    t_start = int(request.args.get('t_start'))
    t_end = int(request.args.get('t_end'))

    if log_names is None:
        return JSONErrorResponse("Missing log filename")

    return JSONResponse(jaialogs.get_moos_messages(log_names, t_start, t_end))


if __name__ == '__main__':
    logging.warning(f'Serving on port {args.port}')
    app.run(host='0.0.0.0', port=args.port, debug=False)
