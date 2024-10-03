#!/usr/bin/env python3

##
## Core REST API application: Combines Flask on main thread with asyncio (for streaming protocol to Goby) on separate thread.
##

import argparse
from flask import Flask, request, jsonify, abort
import jaiabot.messages.rest_api_pb2
import jaiabot.messages.option_extensions_pb2
import google.protobuf.json_format
import importlib
import re
import os
import logging
import threading

from common.api_exception import APIException
import common.target as target
import common.streaming_client as streaming_client
import common.shared_data as shared_data

# Arguments
parser = argparse.ArgumentParser()
parser.add_argument("hostname", type=str, nargs="?", default=os.environ.get("JCC_HUB_IP"), help="goby hostname to send and receive protobuf messages")
parser.add_argument("-p", dest='port', type=int, default=40000, help="goby port to send and receive protobuf messages")
parser.add_argument("-l", dest='logLevel', type=str, default='WARNING', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
parser.add_argument("-b", dest='bindPort', type=int, default=9092, help="bind port for flask server")

args = parser.parse_args()

logLevel = getattr(logging, args.logLevel.upper())
logging.getLogger().setLevel(logLevel)
logging.getLogger('werkzeug').setLevel('WARN')


if args.hostname is None:
    logging.warning('no ip specified, using localhost')    
    args.hostname = "localhost"

try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
except KeyError:
    print("Environment variable JAIA_REST_API_PRIVATE_KEY does not exist. It must be explicitly set to the empty string if you wish to bypass API key checking.")
    exit(1)

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

        if not check_api_key(jaia_request.api_key):
            abort(403) # forbidden
        
        if jaia_request.WhichOneof("action") is None:
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__NO_ACTION_SPECIFIED, "An action must be specified. Valid actions are: " + ", ".join(str(a) for a in valid_actions.keys()))

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

        if not check_api_key(jaia_request.api_key):
            abort(403) # forbidden

        jaia_response.CopyFrom(process_request(version, jaia_request))
        
    except APIException as e:  
        jaia_response.error.code = e.code
        jaia_response.error.details = e.details

    return finalize_response(jaia_response, jaia_request)


def parse_get_args(jaia_request_action, action_field_desc):    
    api_key_get = request.args.get("api_key")
    print(api_key_get)
    
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

def check_api_key(key):
    if not api_key:
        return True
    else:
        return key == api_key


streaming_thread = threading.Thread(target=streaming_client.start_streaming, args=(args.hostname, args.port))
streaming_thread.start()

def main():
    app.run(host='0.0.0.0', port=args.bindPort, debug=False)
    
if __name__ == '__main__':
    main()

