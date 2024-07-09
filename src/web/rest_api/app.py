#!/usr/bin/env python3

from flask import Flask, request, jsonify
import jaiabot.messages.rest_api_pb2
import google.protobuf.json_format

from api_exception import APIException
import target

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
        
    except APIException as e:  
        jaia_response.error.code = e.code
        jaia_response.error.details = e.details
        
    return finalize_response(jaia_response, jaia_request)


@app.route("/jaia/v<int:version>/<string:action>/<string:target_str>", methods=['POST'])
def jaia_api_long(version, action, target_str):
    jaia_request = jaiabot.messages.rest_api_pb2.APIRequest()
    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()
    try:
        if not version in valid_versions:
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__UNSUPPORTED_API_VERSION, "Version " + str(version) + " is invalid. Valid versions are: " + ", ".join(str(v for v in valid_versions)))

        if not action in valid_actions.keys():
            raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_ACTION, "Action '" + action + "' is invalid. Valid actions are: " + ", ".join(str(a) for a in valid_actions.keys()))

        jaia_request.target.CopyFrom(target.parse(target_str))

        action_field_desc = valid_actions[action]
        if action_field_desc.type == google.protobuf.descriptor.FieldDescriptor.TYPE_BOOL:
            # auto fill boolean actions
            setattr(jaia_request, action_field_desc.name, True)
        else:
            # parse POST data as JSON for action
            json_request = request.json
            jaia_request_action = getattr(jaia_request, action_field_desc.name)
            google.protobuf.json_format.ParseDict(json_request, jaia_request_action)

        check_initialized(jaia_request)
        
    except APIException as e:  
        jaia_response.error.code = e.code
        jaia_response.error.details = e.details

    return finalize_response(jaia_response, jaia_request)


def check_initialized(jaia_request):
    if not jaia_request.IsInitialized():
        raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__REQUEST_NOT_INITIALIZED, "APIRequest not initialized. Missing fields: " + ", ".join(e for e in jaia_request.FindInitializationErrors()))


def finalize_response(jaia_response, jaia_request):
    jaia_response.request.CopyFrom(jaia_request)
    return google.protobuf.json_format.MessageToDict(jaia_response, preserving_proto_field_name=True)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
