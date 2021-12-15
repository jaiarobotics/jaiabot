#!/usr/bin/env python3

from flask import Flask, send_from_directory, Response, request
import json
import sys
import jaia
import argparse

# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("hostname", type=str, help="goby hostname to send and receive protobuf messages")
parser.add_argument("port", type=int, help="goby port to send and receive protobuf messages")
args = parser.parse_args()

jaia_interface = jaia.Interface(goby_host=(args.hostname, args.port))

app = Flask(__name__)

####### Static files
root = '../dist/client/'

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
def getStatus():
    return JSONResponse(jaia_interface.get_status())


@app.route('/mission/status', methods=['GET'])
def getMissionStatus():
    return JSONResponse(jaia_interface.get_mission_status())

@app.route('/jaia/setManualID', methods=['POST'])
def setManualID():
    return JSONResponse(jaia_interface.set_manual_id())


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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
