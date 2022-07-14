#!/usr/bin/env python3

import argparse
from flask import Flask, send_from_directory, Response, request
import json
import logging

import jaialogs

# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("-p", dest='port', type=int, default=40010, help="Port to serve the jaiaplot interface")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
args = parser.parse_args()

# Setup logging module
logLevel = getattr(logging, args.logLevel.upper())
logging.basicConfig(level=logLevel)
logging.getLogger('werkzeug').setLevel('WARN')

app = Flask(__name__)

####### Static files
root = '../client/dist'

@app.route('/<path>', methods=['GET'])
def getStaticFile(path):
    return send_from_directory(root, path)

@app.route('/', methods=['GET'])
def getRoot():
    return getStaticFile('index.html')

####### API endpoints

def JSONResponse(obj):
    return Response(json.dumps(obj), mimetype='application/json')


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
    return JSONResponse(jaialogs.get_series(log_names, series_names))

@app.route('/map', methods=['GET'])
def getMap():
    log_names = request.args.get('log')
    return JSONResponse(jaialogs.get_map(log_names))


if __name__ == '__main__':
    logging.warning(f'Serving on port {args.port}')
    app.run(host='0.0.0.0', port=args.port, debug=False)
