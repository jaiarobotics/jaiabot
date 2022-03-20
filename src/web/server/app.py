#!/usr/bin/env python3

from flask import Flask, send_from_directory, Response, request
import json
import sys
import jaia
import argparse
import logging

# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("hostname", type=str, nargs="?", help="goby hostname to send and receive protobuf messages")
parser.add_argument("-p", dest='port', type=int, default=40000, help="goby port to send and receive protobuf messages")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
args = parser.parse_args()

# Setup logging module
logLevel = getattr(logging, args.logLevel.upper())
logging.basicConfig(level=logLevel)
logging.getLogger('werkzeug').setLevel(logLevel)

if args.hostname is None:
    logging.warning('no ip specified, using localhost')
    args.hostname = "localhost"

jaia_interface = jaia.Interface(goby_host=(args.hostname, args.port))

app = Flask(__name__)

####### Static files
root = '../dist/client/'
pid = 'pid/'

@app.route('/<path>', methods=['GET'])
def getStaticFile(path):
    return send_from_directory(root, path)

@app.route('/', methods=['GET'])
def getRoot():
    return getStaticFile('index.html')

####### API endpoints

def JSONResponse(obj):
    return Response(json.dumps(obj), mimetype='application/json')


@app.route('/jaia/getStatus', methods=['GET'])
def getABStatus():
    return JSONResponse(jaia_interface.get_ab_status())

@app.route('/jaia/status', methods=['GET'])
def getStatus():
    return JSONResponse(jaia_interface.get_status())

@app.route('/jaia/command', methods=['POST'])
def postCommand():
    jaia_interface.post_command(request.json)
    return JSONResponse({"status": "ok"})

@app.route('/jaia/allStop', methods=['POST'])
def postAllStop():
    jaia_interface.post_all_stop()
    return JSONResponse({'status': 'ok'})

@app.route('/mission/status', methods=['GET'])
def getMissionStatus():
    return JSONResponse(jaia_interface.get_mission_status())

@app.route('/jaia/setManualID', methods=['POST'])
def setManualID():
    return JSONResponse(jaia_interface.set_manual_id())

@app.route('/jaia/pid-command', methods=['POST'])
def postPidCommand():
    jaia_interface.post_pid_command(request.json)
    return JSONResponse({"status": "ok"})

######## Map tiles

@app.route('/tiles/index', methods=['GET'])
def getTilesIndex():
    return JSONResponse({
        'ok': True,
        'maps': []
    })


######## Mission files


@app.route('/missionfiles/list', methods=['GET'])
def getMissionFilesList():
    return JSONResponse([])


######## PID control

@app.route('/pid/<path>', methods=['GET'])
def pidStaticFile(path):
    return send_from_directory(pid, path)

@app.route('/pid/', methods=['GET'])
def pidRoot():
    return pidStaticFile('index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
