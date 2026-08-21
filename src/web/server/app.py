#!/usr/bin/env python3

import argparse
from flask import Flask, send_from_directory, Response, request
from flask_compress import Compress
import json
import logging
import os
import io
import zipfile
import shutil
from datetime import *
from pathlib import Path
from http import HTTPStatus
from flask import Flask, send_from_directory, Response, request, send_file

# Internal Imports
from pyjaia.battery_prediction import predict_drain as battery_predict_drain
from pyjaia.battery_prediction.inference import UnsupportedBotTypeError, get_supported_bot_types
from pyjaia.battery_prediction.calibration import load_calibration

import jaia_portal
import missions
from map_tile_server import MapTileServer
from map_tile_server.mime_types import *

def parseDate(date):
    if date is None or date == '':
        return None
    
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
parser.add_argument("-p", dest='portal_port', type=int, default=40000, help="port to send and receive protobuf messages with jaiabot_web_portal")
parser.add_argument("-P", dest='web_port', type=int, default=40001, help="HTTP port for web browser connection")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
parser.add_argument("-a", dest='appRoot', type=str, default='../', help="Root directory from which to serve the client apps")
parser.add_argument("-m", dest='mapDirectory', type=str, default='~/maps/', help="Directory to find offline map sets")
args = parser.parse_args()

# Setup logging module
logLevel = getattr(logging, args.logLevel.upper())
logging.getLogger().setLevel(logLevel)
logging.getLogger('werkzeug').setLevel('WARN')

if args.hostname is None:
    logging.warning('no ip specified, using localhost')    
    args.hostname = "localhost"

jaia_interface = jaia_portal.Interface(goby_host=(args.hostname, args.portal_port), read_only=args.read_only)

app = Flask(__name__)
app.config['COMPRESS_MIMETYPES'] = [
    'text/html', 'text/css', 'text/xml',
    'application/json', 'application/javascript', 'text/javascript'
]
Compress(app)

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


######## Exclusion zone sets

# Respect jaia_log_dir so simulation and runtime each store in their own directory.
_LOG_DIR = Path(os.environ.get('jaia_log_dir', '/var/log/jaiabot'))
EXCLUSION_ZONES_DIR = _LOG_DIR / 'exclusion-zones'


def _zone_set_path(name: str) -> Path:
    """Returns the filesystem path for a named exclusion zone set.

    Raises ValueError if the name contains characters that could allow
    directory traversal or other path manipulation.
    """
    if not name or '/' in name or '\\' in name or name.startswith('.') or '..' in name:
        raise ValueError(f"Invalid zone set name: {name!r}")
    return EXCLUSION_ZONES_DIR / f"{name}.json"


@app.route('/jaia/v0/exclusion-zones', methods=['GET'])
def list_exclusion_zones():
    """Returns a sorted list of saved exclusion zone set names."""
    EXCLUSION_ZONES_DIR.mkdir(parents=True, exist_ok=True)
    names = sorted(p.stem for p in EXCLUSION_ZONES_DIR.glob("*.json"))
    return JaiaResponse(names)


@app.route('/jaia/v0/exclusion-zones/<name>', methods=['GET'])
def get_exclusion_zone(name: str):
    """Returns the saved exclusion zone set with the given name."""
    try:
        path = _zone_set_path(name)
    except ValueError as e:
        return ErrorResponse(HTTPStatus.BAD_REQUEST, str(e))
    if not path.exists():
        return ErrorResponse(HTTPStatus.NOT_FOUND, f"Zone set not found: {name!r}")
    return JSONResponse(string=path.read_text())


@app.route('/jaia/v0/exclusion-zones/<name>', methods=['POST'])
def save_exclusion_zone(name: str):
    """Saves (or overwrites) a named exclusion zone set."""
    try:
        path = _zone_set_path(name)
    except ValueError as e:
        return ErrorResponse(HTTPStatus.BAD_REQUEST, str(e))
    EXCLUSION_ZONES_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(request.get_data(as_text=True))
    return JSONResponse({"status": "ok"})


@app.route('/jaia/v0/exclusion-zones/<name>', methods=['DELETE'])
def delete_exclusion_zone(name: str):
    """Deletes a named exclusion zone set."""
    try:
        path = _zone_set_path(name)
    except ValueError as e:
        return ErrorResponse(HTTPStatus.BAD_REQUEST, str(e))
    if not path.exists():
        return ErrorResponse(HTTPStatus.NOT_FOUND, f"Zone set not found: {name!r}")
    path.unlink()
    return JSONResponse({"status": "ok"})


######## Mission sets

MISSION_SETS_DIR = _LOG_DIR / 'mission-sets'


def _mission_set_path(name: str) -> Path:
    """Returns the filesystem path for a named mission set.

    Raises ValueError if the name contains characters that could allow
    directory traversal or other path manipulation.
    """
    if not name or '/' in name or '\\' in name or name.startswith('.') or '..' in name:
        raise ValueError(f"Invalid mission set name: {name!r}")
    return MISSION_SETS_DIR / f"{name}.json"


@app.route('/jaia/v0/mission-sets', methods=['GET'])
def list_mission_sets():
    """Returns a sorted list of saved mission set names."""
    MISSION_SETS_DIR.mkdir(parents=True, exist_ok=True)
    names = sorted(p.stem for p in MISSION_SETS_DIR.glob("*.json"))
    return JaiaResponse(names)


@app.route('/jaia/v0/mission-sets/<name>', methods=['GET'])
def get_mission_set(name: str):
    """Returns the saved mission set with the given name."""
    try:
        path = _mission_set_path(name)
    except ValueError as e:
        return ErrorResponse(HTTPStatus.BAD_REQUEST, str(e))
    if not path.exists():
        return ErrorResponse(HTTPStatus.NOT_FOUND, f"Mission set not found: {name!r}")
    return JSONResponse(string=path.read_text())


@app.route('/jaia/v0/mission-sets/<name>', methods=['POST'])
def save_mission_set(name: str):
    """Saves (or overwrites) a named mission set."""
    try:
        path = _mission_set_path(name)
    except ValueError as e:
        return ErrorResponse(HTTPStatus.BAD_REQUEST, str(e))
    MISSION_SETS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(request.get_data(as_text=True))
    return JSONResponse({"status": "ok"})


@app.route('/jaia/v0/mission-sets/<name>', methods=['DELETE'])
def delete_mission_set(name: str):
    """Deletes a named mission set."""
    try:
        path = _mission_set_path(name)
    except ValueError as e:
        return ErrorResponse(HTTPStatus.BAD_REQUEST, str(e))
    if not path.exists():
        return ErrorResponse(HTTPStatus.NOT_FOUND, f"Mission set not found: {name!r}")
    path.unlink()
    return JSONResponse({"status": "ok"})


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

    result = jaia_interface.task_packet_database.get_task_packets(start_date=startDate, end_date=endDate)
    return JaiaResponse(result)

@app.route('/jaia/v0/task-packets-version', methods=['GET'])
def getTaskPacketsVersion():
    return JSONResponse(jaia_interface.task_packet_database.get_task_packets_version())

@app.route('/jaia/v0/task-packet-include', methods=['POST'])
def postTaskPacketInclude():
    jaia_interface.task_packet_database.set_task_packet_included(request.json["task_packet_id"], request.json["include"])
    return JSONResponse({"status": "ok"})

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


###### Offline maps

map_tile_server = MapTileServer("/var/log/jaiabot/lib/maps/")

@app.route('/maps/', methods=['GET'])
def get_maps():
    """Get a list of the available map sets.
    """
    return Response(response=json.dumps(map_tile_server.get_maps()),
                        status=HTTPStatus.OK,
                        mimetype=MIME_TYPE_JSON)


@app.route('/maps/<map_name>/<z>/<x>/<y>', methods=['GET', 'PUT', 'HEAD'])
def map_tile(map_name: str, z: str, x: str, y: str):
    """Get or put a map tile.

    Args:
        map_name (str): Name of the map tileset.
        z (str): Zoom level of the tile.
        x (str): X index of the tile.
        y (str): Y index of the tile.

    Returns:
        Response: Status of 200 OK if the operation was successful.  Status of 404 Not Found if the tile doesn't exist on the hub.

    Note:
        A HEAD request can be performed to find out if a tile already exists, without transferring the tile's contents.
    """

    method = request.method
    if method in {'HEAD', 'GET'}:
        tile_data = map_tile_server.get_tile(map_name, int(z), int(x), int(y))
    
        if tile_data is None:
            return Response(status=HTTPStatus.NOT_FOUND)
    
    if method == 'GET':
        return Response(tile_data, status=HTTPStatus.OK, mimetype=MIME_TYPE_PNG)

    elif method == 'HEAD':
        return Response(None, status=HTTPStatus.OK, mimetype=MIME_TYPE_PNG)

    elif request.method == 'PUT':
        map_tile_server.put_tile(map_name, z, x, y, request.data)
        return Response(status=HTTPStatus.OK)


@app.route('/maps/<map_name>/geotiff', methods=['PUT'])
def put_map_geotiff(map_name: str):
    """Put a geotiff file into a tile server map

    Args:
        map_name (str): Name of the target map
    """

    try:
        map_tile_server.put_map_geotiff(map_name, request.data)
        return Response(status=HTTPStatus.OK)
    except Exception as e:
        print(e)
        print('Failed!')
        return ErrorResponse(HTTPStatus.INTERNAL_SERVER_ERROR, str(e), 1)


@app.route('/maps/<map_name>/geotiffchunk/<chunk_index>', methods=['PUT'])
def put_map_geotiff_chunk(map_name: str, chunk_index: int):
    """Put a geotiff file chunk into a tile server map.  A chunk size of zero means the geotiff is fully uploaded.

    Args:
        map_name (str): Name of the target map
    """

    try:
        map_tile_server.put_map_geotiff_chunk(map_name, chunk_index, request.data)
        return Response(status=HTTPStatus.OK)
    except Exception as e:
        print(e)
        print('Failed!')
        return ErrorResponse(HTTPStatus.INTERNAL_SERVER_ERROR, str(e), 1)


@app.route('/maps/<map_name>', methods=['DELETE'])
def delete_map(map_name: str):
    """Delete an offline map layer

    Args:
        map_name (str): Name of the offline hub map layer to delete.
    """
    map_tile_server.delete_map(map_name)
    return Response(status=HTTPStatus.OK)

@app.route('/ctd-profiles')
def get_ctd_profiles():
    """Provides access to CTD files on the Hub
    """
    dir = Path("/var/log/jaiabot/bot_offload")
    files = list(dir.glob("*.unb")) if dir.exists() else []

    if len(files) == 0:
        return Response(status=HTTPStatus.NO_CONTENT)

    zip_file = io.BytesIO()
    with zipfile.ZipFile(zip_file, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            zf.write(path, arcname=path.name)
    zip_file.seek(0)
    zip_name = "jaia-ctd.zip"

    # Move zipped files to archive so they are not re-zipped
    ctd_archive = dir / "ctd_archive"
    ctd_archive.mkdir(parents=True, exist_ok=True)
    for ctd_file in files:
        shutil.move(str(ctd_file), ctd_archive / ctd_file.name);
    
    return send_file(
        zip_file,
        as_attachment=True,
        download_name=zip_name,
        mimetype="application/zip",
    )

@app.route('/jaia/v0/battery-calibration', methods=['GET'])
def battery_calibration():
    """Returns the calibrated wattage/energy constants used to turn a mission
    plan into the features the battery drain model expects, plus the bot type
    names the model was trained on."""
    return JSONResponse(obj={
        **load_calibration(),
        'supported_bot_types': [
            jaia_portal.BotStatus.BotType.Name(t) for t in get_supported_bot_types()
        ],
    })


@app.route('/jaia/v0/battery-prediction', methods=['POST'])
def battery_prediction():
    """Predicts the battery drain for a mission from its extracted features."""
    body = request.get_json()
    required = [
        'bot_type', 'transit_energy_wh', 'transit_time_s',
        'turn_density_deg_per_km',
        'hotel_energy_wh', 'dive_energy_wh',
        'starting_battery_pct',
    ]
    missing = [k for k in required if k not in body]
    if missing:
        return ErrorResponse(HTTPStatus.BAD_REQUEST, f"Missing fields: {missing}", 1)

    try:
        drain = battery_predict_drain(
            bot_type=jaia_portal.BotStatus.BotType.Value(body['bot_type']),
            transit_energy_wh=float(body['transit_energy_wh']),
            transit_time_s=float(body['transit_time_s']),
            turn_density_deg_per_km=float(body['turn_density_deg_per_km']),
            hotel_energy_wh=float(body['hotel_energy_wh']),
            dive_energy_wh=float(body['dive_energy_wh']),
            starting_battery_pct=float(body['starting_battery_pct']),
        )
        starting = float(body['starting_battery_pct'])
        return JSONResponse(obj={
            'predicted_drain_pct': round(drain, 1),
            'predicted_final_pct': round(starting - drain, 1),
        })
    except (UnsupportedBotTypeError, ValueError) as e:
        return ErrorResponse(HTTPStatus.UNPROCESSABLE_ENTITY, str(e), 1)
    except Exception as e:
        return ErrorResponse(HTTPStatus.INTERNAL_SERVER_ERROR, str(e), 1)


if __name__ == '__main__':
    print(f"JCC: connect to http://127.0.0.1:{args.web_port}")
    app.run(host='0.0.0.0', port=args.web_port, debug=False)
