#!/usr/bin/env python3

##
## Core REST API application: Combines Flask on main thread with asyncio (for streaming protocol to Goby) on separate thread.
##

import argparse
from flask import Flask, request, jsonify, abort
import jaiabot.messages.rest_api_pb2
import jaiabot.messages.option_extensions_pb2
import google.protobuf.json_format
from google.protobuf import text_format
import importlib
import re
import os
import logging
import threading

from common.api_exception import APIException
import common.target as target
import common.streaming_client as streaming_client
import common.shared_data as shared_data
import common.endpoint_parse as endpoint_parse

from jaiabot.messages.rest_api_pb2 import APIConfig

# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("-e", "--streaming_endpoint", type=str, nargs="?", help="HubID:Hostname:Port for streaming API (jaiabot_web_portal) - more than one hub can be comma delimited, e.g. '1:[fd0f:77ac:4fdf::1]:40000,2:[fd0f:77ac:4fdf::2]:40000'")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
parser.add_argument("-b", dest='bindPort', type=int, nargs="?", help="bind port for flask server")
parser.add_argument("-c", dest='cfgFile', type=str, default='/etc/jaiabot/rest_api.pb.cfg',  help="Configuration file (TextFormat version of jaiabot.protobuf.APIConfig)")

args = parser.parse_args()
    
logLevel = getattr(logging, args.logLevel.upper())
logging.getLogger().setLevel(logLevel)
logging.getLogger('werkzeug').setLevel('WARN')

# Parse configuration file
cfg = APIConfig()
try:
    with open(args.cfgFile, 'r') as f:
        text_data = f.read()
        text_format.Parse(text_data, cfg)
except FileNotFoundError:
    logging.warning(f'The configuration file {args.cfgFile} was not found. Using command line parameters only.')
except text_format.ParseError as e:
    logging.warning(f'Failed to parse Protobuf Text Format from {args.cfgFile}: {e}')
    exit(1)

# Overwrite configuration file with command line parameters
if args.bindPort is not None:
    cfg.flask_bind_port = args.bindPort

# Fallback to default streaming endpoint
if args.streaming_endpoint is None and not cfg.streaming_endpoint:
    if os.environ.get("JCC_HUB_IP") is not None:
        # Fall back to JCC single HUB IP and default port
        hub_ip=os.environ.get("JCC_HUB_IP")
        logging.warning(f'no ip specified, using JCC_HUB_IP env var with HUB 1 at {hub_ip}:40000')
        args.streaming_endpoint = f"1:{hub_ip}:40000"
    else:
        logging.warning('no ip specified, using HUB 1 at localhost:40000')
        args.streaming_endpoint = "1:localhost:40000"

if args.streaming_endpoint is not None:
    streaming_endpoints = endpoint_parse.parse_all(args.streaming_endpoint)
    for hub_id,endpoint in streaming_endpoints.items():
        ep = cfg.streaming_endpoint.add()
        ep.hub_id = hub_id
        ep.hostname = endpoint[0]
        ep.port = endpoint[1]

# Parse legacy JAIA_REST_API_PRIVATE_KEY environmental variable
try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
    if api_key == '':
        # only consider an empty string to be no key required if no keys are explicitly set
        if not cfg.HasField('no_key_required') and not cfg.key:
            cfg.no_key_required = True
    else:
        k = cfg.key.add()
        k.private_key = api_key
        k.permission.append(APIConfig.APIKey.ALL)
except KeyError:
    pass

if cfg.no_key_required == False and not cfg.key:
    logging.warning('API Key required (no_key_required: false) but no keys provided. Please check configuration file or explicitly set environmental variable JAIA_REST_API_PRIVATE_KEY="" (to the empty string)')
    exit(1)

if cfg.no_key_required == True and cfg.key:
    logging.warning('API Key not required (no_key_required: true) but keys are provided. Please remove keys from the configuration file.')
    exit(1)

    
logging.info(f'Starting up with configuration: {cfg}')
    
app = Flask(__name__)

valid_versions=[1]
valid_actions={}
for field in jaiabot.messages.rest_api_pb2.APIRequest.DESCRIPTOR.oneofs_by_name['action'].fields:
    valid_actions[field.name]=field
    
@app.route("/jaia/v<int:version>", methods=['POST'])
def jaia_api_short(version):
    jaia_request = jaiabot.messages.rest_api_pb2.APIRequest()
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()
    json_request = request.json
    try:
        try:
            google.protobuf.json_format.ParseDict(json_request, jaia_request)
        except google.protobuf.json_format.Error as e:
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__COULD_NOT_PARSE_API_REQUEST_JSON, "Failed to parse POST JSON as an APIRequest Protobuf message: " + str(e))

        check_initialized(jaia_request)

        if jaia_request.WhichOneof("action") is None:
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__NO_ACTION_SPECIFIED, "An action must be specified. Valid actions are: " + ", ".join(str(a) for a in valid_actions.keys()))
        
        if not check_api_key(jaia_request.api_key, jaia_request.WhichOneof("action")):
            abort(403) # forbidden

        jaia_response.CopyFrom(process_request(version, jaia_request))
        
    except APIException as e:  
        jaia_response.error.code = e.code
        jaia_response.error.details = e.details
        
    return finalize_response(jaia_response, jaia_request)


@app.route("/jaia/v<int:version>/<string:action>/<string:target_str>", methods=['GET', 'POST'])
def jaia_api_long(version, action, target_str):
    jaia_request = jaiabot.messages.rest_api_pb2.APIRequest()
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()
    try:
        if not version in valid_versions:
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__UNSUPPORTED_API_VERSION, "Version " + str(version) + " is invalid. Valid versions are: " + ", ".join(str(v) for v in valid_versions))

        if not action in valid_actions.keys():
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_ACTION, "Action '" + action + "' is invalid. Valid actions are: " + ", ".join(str(a) for a in valid_actions.keys()))

        jaia_request.target.CopyFrom(target.parse(target_str))

        action_field_desc = valid_actions[action]
        if action_field_desc.type == google.protobuf.descriptor.FieldDescriptor.TYPE_BOOL:
            # auto fill boolean actions
            setattr(jaia_request, action_field_desc.name, True)

            if request.method == 'POST':
                json_request = request.json
                if "api_key" in json_request:
                    jaia_request.api_key = json_request["api_key"]
            elif request.method == 'GET':
                api_key_get = request.args.get("api_key")            
                if api_key_get:
                    jaia_request.api_key = api_key_get
        else:
            jaia_request_action = getattr(jaia_request, action_field_desc.name)
            # set to empty action message so we can catch uninitialized child fields
            jaia_request_action.CopyFrom(action_field_desc.message_type._concrete_class())
            # parse POST data as JSON for action
            if request.method == 'POST':
                json_request = request.json
                if "api_key" in json_request:
                    jaia_request.api_key = json_request["api_key"]
                    # remove so Protobuf parses correctly
                    del json_request["api_key"]
                
                try:
                    google.protobuf.json_format.ParseDict(json_request, jaia_request_action)
                except google.protobuf.json_format.Error as e:
                    raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__COULD_NOT_PARSE_API_REQUEST_JSON, "Failed to parse POST JSON as a '" + jaia_request_action.DESCRIPTOR.full_name + "' Protobuf message: " + str(e))
            elif request.method == 'GET':
                key, request_action = parse_get_args(jaia_request_action, action_field_desc)
                jaia_request_action.CopyFrom(request_action)
                if key:
                    jaia_request.api_key = key
                
        check_initialized(jaia_request)

        if not check_api_key(jaia_request.api_key, action):
            abort(403) # forbidden

        jaia_response.CopyFrom(process_request(version, jaia_request))
        
    except APIException as e:  
        jaia_response.error.code = e.code
        jaia_response.error.details = e.details

    return finalize_response(jaia_response, jaia_request)


def parse_get_args(jaia_request_action, action_field_desc):    
    api_key_get = request.args.get("api_key")
    
    for field in jaia_request_action.DESCRIPTOR.fields:
        get_var = request.args.get(field.name)
        if get_var is not None:
            if field.label == google.protobuf.descriptor.FieldDescriptor.LABEL_REPEATED:
                raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__ACTION_REQUIRES_JSON_POST_DATA, "Repeated fields are not supported via GET. Use POST to pass JSON according to the '" + jaia_request_action.DESCRIPTOR.full_name + "' Protobuf message")
                
            elif field.cpp_type in (field.CPPTYPE_INT32, 
                                    field.CPPTYPE_INT64,
                                    field.CPPTYPE_UINT32,
                                    field.CPPTYPE_UINT64):
                try:
                    setattr(jaia_request_action, field.name, int(get_var))
                except ValueError:
                    raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_TYPE, f'Expected integer value for field {field.name}, got "{get_var}"')
            elif field.cpp_type in (field.CPPTYPE_DOUBLE, 
                                    field.CPPTYPE_FLOAT):
                try:
                    setattr(jaia_request_action, field.name, float(get_var))
                except ValueError:
                    raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_TYPE, f'Expected floating point value for field {field.name}, got "{get_var}"')
            elif field.cpp_type == field.CPPTYPE_BOOL:
                try:
                    setattr(jaia_request_action, field.name, bool(get_var))
                except ValueError:
                    raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_TYPE, f'Expected boolean value for field {field.name}, got "{get_var}"')
            elif field.type == field.TYPE_ENUM:
                enum_type = field.enum_type
                if get_var in enum_type.values_by_name.keys():
                    setattr(jaia_request_action, field.name, enum_type.values_by_name[get_var].number)
                else:
                    raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__COULD_NOT_PARSE_API_REQUEST_JSON, "Invalid enum '" + get_var + " for field " + field.name + ". Valid options are: " + ", ".join(e for e in enum_type.values_by_name.keys()))
                
            elif field.cpp_type == field.CPPTYPE_STRING:
                setattr(jaia_request_action, field.name, get_var)                
            else:
                raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__ACTION_REQUIRES_JSON_POST_DATA, "The type of field '" + field.name + "' is not supported via GET. Use POST to pass JSON according to the '" + jaia_request_action.DESCRIPTOR.full_name + "' Protobuf message")
                
    return (api_key_get, jaia_request_action)


def check_initialized(jaia_request):
    if not jaia_request.IsInitialized():
        # verify that uninitialized fields are not OMITTED
        uninitialized = jaia_request.FindInitializationErrors()
        api_required_uninitialized = list()
        
        for u in uninitialized:
            # expect 'foo.bar[2].bar' string - strip off the repeated info (e.g., '[2]')
            pattern = re.compile(r'(\w+)(\[\d+\])?')
            matches = pattern.findall(u)    
            parts = [match[0] for match in matches]            
            if not is_omitted(parts, jaia_request.DESCRIPTOR):
                api_required_uninitialized.append(u)

        if api_required_uninitialized:
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__REQUEST_NOT_INITIALIZED, "APIRequest not initialized. Missing fields: " + ", ".join(e for e in api_required_uninitialized))

def process_request(version, jaia_request):
    api_module = importlib.import_module("v" + str(version) + ".api")
    return api_module.process_request(jaia_request)

def finalize_response(jaia_response, jaia_request):
    jaia_response.request.CopyFrom(jaia_request)
    return google.protobuf.json_format.MessageToDict(jaia_response, preserving_proto_field_name=True)

# Recursively check for OMITTED presence, if found at any node in the tree, return True
def is_omitted(parts, descriptor):
    if not parts:
        return False
    else: 
        field = descriptor.fields_by_name[parts[0]]
        presence = field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.presence
        if presence == jaiabot.messages.option_extensions_pb2.RestAPI.OMITTED:
            return True
        else:
            return is_omitted(parts[1:], field.message_type)

def check_api_key(key, action):
    if cfg.no_key_required:
        return True
    else:
        for k in cfg.key:
            if key == k.private_key:
                for perm in k.permission:
                    enum_descriptor = APIConfig.APIKey.Permission.DESCRIPTOR
                    enum_val_descriptor = enum_descriptor.values_by_number[perm]
                    permitted_actions = enum_val_descriptor.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.ev].rest_api.permitted_action
                    for a in permitted_actions:
                        if a == action:
                            return True
                logging.info(f'Key found, but no permission to use action {action}')
                return False
        logging.info('Key not found')
        return False

with shared_data.data_lock:
    shared_data.create_queues(cfg.streaming_endpoint)

streaming_thread=dict()
for ep in cfg.streaming_endpoint:
    streaming_thread[ep.hub_id] = threading.Thread(target=streaming_client.start_streaming, args=(ep.hub_id, (ep.hostname, ep.port)))
    streaming_thread[ep.hub_id].start()

def main():
    app.run(host='0.0.0.0', port=cfg.flask_bind_port, debug=False)
    
if __name__ == '__main__':
    main()

