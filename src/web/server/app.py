#!/usr/bin/env python3

import argparse
from flask import Flask, send_from_directory, Response, request
import json
import logging
from datetime import *

def parseDate(date):
    if date is None:
        return None
    
    try:
        date_str = str(date).split(".")[0]
        date_format = "%Y-%m-%d %H:%M:%S"
        return datetime.strptime(date_str, date_format)
    except:
        logging.warning(f'Could not parse date: {date}')
        return None

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
    logging.warning('no ip specified, using localhost:40001')
    args.hostname = "localhost"

jaia_interface = jaia.Interface(goby_host=(args.hostname, args.port), read_only=args.read_only)

app = Flask(__name__)

####### Static files
root = '../command_control/dist/client/'
jed = '../jed/'

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

@app.route('/jaia/task-packets', methods=['GET'])
# Date format: yyyy-mm-dd hh:mm:ss
# Date timezone: GMT
# Example request: http://10.23.1.10/jaia/task-packets?startDate="2023-10-18 09:04:00"&endDate="2023-10-22 09:04:00"
def getPackets():
    startDate = parseDate(request.args.get('startDate', (datetime.now() - timedelta(hours=14))))
    endDate = parseDate(request.args.get('endDate', datetime.now()))
    return JSONResponse(jaia_interface.get_task_packets(start_date=startDate, end_date=endDate))

@app.route('/jaia/task-packets-count', methods=['GET'])
def getPacketsCount():
    return JSONResponse(jaia_interface.get_total_task_packets_count())

@app.route('/jaia/metadata', methods=['GET'])
def getMetadata():
    return JSONResponse(jaia_interface.get_Metadata())

####### Commands

@app.route('/jaia/command', methods=['POST'])
def postCommand():
    response = jaia_interface.post_command(request.json, clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/command-for-hub', methods=['POST'])
def postCommandForHub():
    response = jaia_interface.post_command_for_hub(request.json, clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/take-control', methods=['POST'])
def postTakeControl():
    response = jaia_interface.post_take_control(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/all-stop', methods=['POST'])
def postAllStop():
    response = jaia_interface.post_all_stop(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/all-activate', methods=['POST'])
def postAllActivate():
    response = jaia_interface.post_all_activate(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/next-task-all', methods=['POST'])
def postNextTaskAll():
    response = jaia_interface.post_next_task_all(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/all-recover', methods=['POST'])
def postAllRecover():
    response = jaia_interface.post_all_recover(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/pid-command', methods=['POST'])
def postPidCommand():
    jaia_interface.post_engineering_command(request.json, clientId=request.headers['clientId'])
    return JSONResponse({"status": "ok"})

@app.route('/jaia/ep-command', methods=['POST'])
def postEngineeringPanel():
    jaia_interface.post_ep_command(request.json, clientId=request.headers['clientId'])
    return JSONResponse({"status": "ok"})

@app.route('/jaia/single-waypoint-mission', methods=['POST'])
def postSingleWaypointMission():
    jaia_interface.post_single_waypoint_mission(request.json, clientId=request.headers['clientId'])
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


######## Jaiabot Engineer & Debug

@app.route('/jed/<path>', methods=['GET'])
def jedStaticFile(path):
    return send_from_directory(jed, path)

@app.route('/jed/', methods=['GET'])
def jedRoot():
    return jedStaticFile('index.html')


######## Contour map

@app.route('/jaia/depth-contours', methods=['GET'])
def get_deth_contours():
    return JSONResponse(jaia_interface.get_depth_contours())


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=40001, debug=False)
