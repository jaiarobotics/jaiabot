#!/usr/bin/env python3

import argparse
from flask import Flask, send_from_directory, Response, request
import json
import logging

# Internal Imports
import jaia
import missions

# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("hostname", type=str, nargs="?", help="goby hostname to send and receive protobuf messages")
parser.add_argument("-r", dest='read_only', action='store_true', help="start a read-only client that cannot send commands")
parser.add_argument("-p", dest='port', type=int, default=40000, help="goby port to send and receive protobuf messages")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
args = parser.parse_args()

# Setup logging module
logLevel = getattr(logging, args.logLevel.upper())
logging.getLogger().setLevel(logLevel)
logging.getLogger('werkzeug').setLevel('WARN')

if args.hostname is None:
    logging.warning('no ip specified, using localhost')
    args.hostname = "localhost"

jaia_interface = jaia.Interface(goby_host=(args.hostname, args.port), read_only=args.read_only)

app = Flask(__name__)

####### Static files
root = '../central_command/dist/client/'
pid = '../engineering/'

@app.route('/<path>', methods=['GET'])
def getStaticFile(path):
    return send_from_directory(root, path)

@app.route('/', methods=['GET'])
def getRoot():
    return getStaticFile('index.html')

####### API endpoints

def JSONResponse(obj):
    return Response(json.dumps(obj), mimetype='application/json')


@app.route('/jaia/status', methods=['GET'])
def getStatus():
    return JSONResponse(jaia_interface.get_status())

@app.route('/jaia/dive-packets', methods=['GET'])
def getDivePackets():
    return JSONResponse(jaia_interface.get_dive_packets())

@app.route('/jaia/command', methods=['POST'])
def postCommand():
    response = jaia_interface.post_command(request.json)
    return JSONResponse(response)

@app.route('/jaia/allStop', methods=['POST'])
def postAllStop():
    response = jaia_interface.post_all_stop()
    return JSONResponse(response)

@app.route('/jaia/allActivate', methods=['POST'])
def postAllActivate():
    response = jaia_interface.post_all_activate()
    return JSONResponse(response)

@app.route('/jaia/pid-command', methods=['POST'])
def postPidCommand():
    jaia_interface.post_engineering_command(request.json)
    return JSONResponse({"status": "ok"})

######## Map tiles

@app.route('/tiles/index', methods=['GET'])
def getTilesIndex():
    return JSONResponse({
        'ok': True,
        'maps': []
    })


######## Mission files

@app.route('/missionfiles/initdb', methods=['GET'])
def init_mission_database():
    return JSONResponse([])

@app.route('/missionfiles/create', methods=['POST'])
def get_mission_list():
    mission_gdf, mission_dict = missions.create_mission_plan(
        deploy_lat=request.json['home_lat'],
        deploy_lon=request.json['home_lon'],
        boundary_points=request.json['survey_polygon'][0],
        mission_type=request.json['mission_type'],
        spacing_meters=int(request.json['sample_spacing']),
        orientation=int(request.json["orientation"]),
        bot_list=request.json['bot_list'],
        # inside_points_all=request.json['inside_points_all']
    )
    return JSONResponse(mission_dict)

@app.route('/missionfiles/save', methods=['POST'])
def save_mission_list():
    return JSONResponse([])

@app.route('/missionfiles/update', methods=['POST'])
def update_mission_list():
    return JSONResponse([])


######## PID control

@app.route('/pid/<path>', methods=['GET'])
def pidStaticFile(path):
    return send_from_directory(pid, path)

@app.route('/pid/', methods=['GET'])
def pidRoot():
    return pidStaticFile('index.html')


######## Contour map

@app.route('/jaia/contour-bounds', methods=['GET'])
def get_contour_bounds():
    return JSONResponse(jaia_interface.get_contour_bounds())


@app.route('/jaia/contour-map', methods=['GET'])
def get_contour_map():
    return Response(jaia_interface.get_contour_map(), mimetype='image/png')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=40001, debug=False)
