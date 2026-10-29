#!/usr/bin/env python3

import argparse
import urllib.error
import urllib.request
from flask import Flask, send_from_directory, Response, request
from flask_compress import Compress
import json
import logging
import os
from http import HTTPStatus

# Internal Imports
from map_tile_server import MapTileServer
from map_tile_server.mime_types import *


# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("-P", dest='web_port', type=int, default=40001, help="HTTP port for web browser connection")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
parser.add_argument("-a", dest='appRoot', type=str, default='../', help="Root directory from which to serve the client apps")
parser.add_argument("-m", dest='mapDirectory', type=str, default='~/maps/', help="Directory to find offline map sets")
parser.add_argument("-R", dest='restApiURL', type=str, default='http://localhost:9092', help="REST API server to forward /jaia/v1 requests to, when no web server in front routes them")
args = parser.parse_args()

# Setup logging module
logLevel = getattr(logging, args.logLevel.upper())
logging.getLogger().setLevel(logLevel)
logging.getLogger('werkzeug').setLevel('WARN')

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


######## REST API

FORWARDED_REQUEST_HEADERS = ['Content-Type', 'clientId']
FORWARDED_RESPONSE_HEADERS = ['Content-Type', 'Content-Disposition']

@app.route('/jaia/v1', methods=['POST'])
@app.route('/jaia/v1/<path:path>', methods=['GET', 'POST'])
def forward_to_rest_api(path: str = None):
    """Forwards REST API requests so JCC can reach the API on its own origin.

    On a hub, Apache routes /jaia to the REST API before requests get here; this covers the
    simulator and the development server, where the REST API runs on its own port.
    """
    url = f'{args.restApiURL}/jaia/v1' + (f'/{path}' if path else '')
    if request.query_string:
        url += '?' + request.query_string.decode()

    headers = {name: request.headers[name] for name in FORWARDED_REQUEST_HEADERS if name in request.headers}
    rest_request = urllib.request.Request(url, data=request.get_data() or None, headers=headers, method=request.method)

    try:
        rest_response = urllib.request.urlopen(rest_request)
    except urllib.error.HTTPError as e:
        rest_response = e
    except urllib.error.URLError as e:
        # Shaped like an APIResponse error so REST API clients can report it
        details = f'Could not reach the REST API at {args.restApiURL}: {e.reason}'
        return Response(json.dumps({'error': {'details': details}}), status=HTTPStatus.BAD_GATEWAY, mimetype='application/json')

    with rest_response:
        return Response(
            rest_response.read(),
            status=rest_response.status,
            headers={name: rest_response.headers[name] for name in FORWARDED_RESPONSE_HEADERS if name in rest_response.headers},
        )


######## Jaiabot Engineer & Debug

@app.route('/jed/<path>', methods=['GET'])
def jedStaticFile(path):
    return send_from_directory(jed, path)

@app.route('/jed/', methods=['GET'])
def jedRoot():
    return jedStaticFile('index.html')


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

if __name__ == '__main__':
    print(f"JCC: connect to http://127.0.0.1:{args.web_port}")
    app.run(host='0.0.0.0', port=args.web_port, debug=False)
