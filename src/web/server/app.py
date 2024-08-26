#!/usr/bin/env python3

import argparse
from flask import Flask, send_from_directory, Response, request
import json
import logging
import os
from datetime import *
import os
from http import HTTPStatus

# Internal Imports
import jaia_portal
import missions
from geotiffs import GeoTiffs
from annotations import Annotations

def parseDate(date):
    if date is None or date == '':
        return ''
    
    try:
        date_str = str(date).split(".")[0]
        date_format = "%Y-%m-%d %H:%M:%S"
        return datetime.strptime(date_str, date_format)
    except:
        logging.warning(f'Could not parse date: {date}')
        return None


# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("hostname", type=str, nargs="?", default=os.environ.get("JCC_HUB_IP"), help="goby hostname to send and receive protobuf messages")
parser.add_argument("-r", dest='read_only', action='store_true', help="start a read-only client that cannot send commands")
parser.add_argument("-p", dest='port', type=int, default=40000, help="goby port to send and receive protobuf messages")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
parser.add_argument("-a", dest='appRoot', type=str, default='../', help="Root directory from which to serve the client apps")
args = parser.parse_args()

# Setup logging module
logLevel = getattr(logging, args.logLevel.upper())
logging.getLogger().setLevel(logLevel)
logging.getLogger('werkzeug').setLevel('WARN')

if args.hostname is None:
    logging.warning('no ip specified, using localhost')    
    args.hostname = "localhost"

jaia_interface = jaia_portal.Interface(goby_host=(args.hostname, args.port), read_only=args.read_only)

app = Flask(__name__)

####### Static files
jcc: str = os.path.join(args.appRoot, 'jcc')
jed: str = os.path.join(args.appRoot, 'jed')

@app.route('/<path>', methods=['GET'])
def getStaticFile(path: str):
    return send_from_directory(jcc, path)

@app.route('/', methods=['GET'])
def getRoot():
    return getStaticFile('index.html')

####### API endpoints

def JSONResponse(obj: any=None, string: str=None):
    if obj is not None:
        return Response(json.dumps(obj), mimetype='application/json')
    if string is not None:
        return Response(string, mimetype='application/json')


def ErrorResponse(status: int, error_message: str, error_code: int=None):
    """Returns an error response with a message and an error code.

    Args:
        status (int): The http status code for the response.
        error_message (str): The error message to return to the client via JSON.
        error_code (int, optional): The error code to return to the client via JSON. Defaults to None.

    Returns:
        Response: The Flask response object.
    """
    responseObject = {
        'error': {
            'message': error_message,
            'code': error_code
        }
    }
    return Response(json.dumps(responseObject), status=status, mimetype='application/json')


def JaiaResponse(result: any):
    """Returns a response with result.

    Args:
        result (any): The result.

    Returns:
        Response: The Flask response object.
    """
    responseObject = {
        'result': result
    }
    return Response(json.dumps(responseObject), mimetype='application/json')


@app.route('/jaia/v0/status', methods=['GET'])
def getStatus():
    return JSONResponse(jaia_interface.get_status())

@app.route('/jaia/v0/status-bots', methods=['GET'])
def getStatusBots():
    """Gets dictionary of most up-to-date bot statuses

    Returns:
        Response: Dictionary of latest bot statuses
    """
    return JSONResponse(jaia_interface.get_status_bots())

@app.route('/jaia/v0/status-hubs', methods=['GET'])
def getStatusHubs():
    """Gets dictionary of most up-to-date hub statuses

    Returns:
        Response: Dictionary of latest hub statuses
    """
    return JSONResponse(jaia_interface.get_status_hubs())

@app.route('/jaia/v0/metadata', methods=['GET'])
def getMetadata():
    return JSONResponse(jaia_interface.get_Metadata())

####### Commands

@app.route('/jaia/v0/command', methods=['POST'])
def postCommand():
    response = jaia_interface.post_command(request.json, clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/v0/command-for-hub', methods=['POST'])
def postCommandForHub():
    response = jaia_interface.post_command_for_hub(request.json, clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/v0/take-control', methods=['POST'])
def postTakeControl():
    response = jaia_interface.post_take_control(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/v0/all-stop', methods=['POST'])
def postAllStop():
    response = jaia_interface.post_all_stop(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/v0/all-activate', methods=['POST'])
def postAllActivate():
    response = jaia_interface.post_all_activate(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/v0/next-task-all', methods=['POST'])
def postNextTaskAll():
    response = jaia_interface.post_next_task_all(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/v0/all-recover', methods=['POST'])
def postAllRecover():
    response = jaia_interface.post_all_recover(clientId=request.headers['clientId'])
    return JSONResponse(response)

@app.route('/jaia/v0/engineering-command', methods=['POST'])
def postPidCommand():
    jaia_interface.post_engineering_command(request.json, clientId=request.headers['clientId'])
    return JSONResponse({"status": "ok"})

@app.route('/jaia/v0/ep-command', methods=['POST'])
def postEngineeringPanel():
    jaia_interface.post_ep_command(request.json, clientId=request.headers['clientId'])
    return JSONResponse({"status": "ok"})

@app.route('/jaia/v0/single-waypoint-mission', methods=['POST'])
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

######## TaskPackets

@app.route('/jaia/v0/task-packets', methods=['GET'])
def getPackets():
    """
    Date Format: yyyy-mm-dd hh:mm:ss
    Timezone: GMT
    Example Request: http://10.23.1.10/jaia/v0/task-packets?startDate="2023-10-18 09:04:00"&endDate="2023-10-22 09:04:00"
    """
    startDate = parseDate(request.args.get('startDate', (datetime.now(timezone.utc) - timedelta(hours=14))))
    endDate = parseDate(request.args.get('endDate', ''))
    return JSONResponse(jaia_interface.get_task_packets(start_date=startDate, end_date=endDate))

@app.route('/jaia/v0/task-packets-count', methods=['GET'])
def getPacketsCount():
    return JSONResponse(jaia_interface.get_total_task_packets_count())

######## Contour map

@app.route('/jaia/v0/depth-contours', methods=['GET'])
def get_deth_contours():
    start_date = parseDate(request.args.get('startDate', (datetime.now() - timedelta(hours=14))))
    end_date = parseDate(request.args.get('endDate', ''))
    return JSONResponse(jaia_interface.get_depth_contours(start_date, end_date))

######## Drift map

@app.route('/jaia/v0/drift-map', methods=['GET'])
def get_drift_map():
    start_date = parseDate(request.args.get('startDate', (datetime.now() - timedelta(hours=14))))
    end_date = parseDate(request.args.get('endDate', ''))
    return JSONResponse(string=jaia_interface.get_drift_map(start_date, end_date))


######## Bot paths

@app.route('/jaia/v0/bot-paths', methods=['GET'])
def get_bot_paths():
    since_utime: int

    try:
        since_utime = int(request.args.get('since-utime'))
    except ValueError:
        message = f"{request.url}: since-utime is not a valid integer"
        logging.warning(message)
        return ErrorResponse(HTTPStatus.BAD_REQUEST, message, 1)
    except TypeError:
        since_utime = None
    
    return JaiaResponse(jaia_interface.get_bot_paths(since_utime))


####### GeoTIFF files

geoTiff_root = '/usr/share/jaiabot/overlays'

@app.route('/geoTiffs/<path>', methods=['GET'])
def getGeoTiffFile(path):
    return send_from_directory(geoTiff_root, path)

@app.route('/geoTiffs', methods=['GET'])
def listGeoTiffFiles():
    geoTiffs = GeoTiffs(geoTiff_root)
    return JSONResponse(obj=geoTiffs.list())


####### User annotations

# Map annotations
annotations = Annotations()

@app.route('/jaia/v0/annotations', methods=['GET', 'POST', 'DELETE'])
def jaia_v0_annotations():
    global annotations

    if request.method == 'GET':
        # `version` is the last version of the annotations GeoJSON that we retrieved.  
        # If there has been no change since then, we can return a 304 Not Modified response.
        try:
            version = int(request.args.get('version'))
        except TypeError:
            version = None

        if annotations.version == version:
            return Response(None, 304) # 304 Not Modified
        else:
            return JaiaResponse({
                'version': annotations.version,
                'annotations': annotations.featureCollection
            })
    
    if request.method == 'POST':
        newFeature = request.json
        annotations.appendFeature(newFeature)

        return Response(status=201) # 201 Created

    if request.method == 'DELETE':
        annotations.clearFeatures()

        return Response(status=410) # 410 Gone


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=40001, debug=False)
