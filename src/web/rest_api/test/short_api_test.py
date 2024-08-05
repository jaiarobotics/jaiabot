#!/usr/bin/env python3

import requests
import json
import datetime
import os

try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
except KeyError:
    api_key=""


def is_subset(subset, superset):
    """
    Check if the subset dictionary is a subset of the superset dictionary.
    This works recursively for nested dictionaries.
    """
    for key, value in subset.items():
        if key not in superset:
            return False
        if isinstance(value, dict):
            if not isinstance(superset[key], dict):
                return False
            if not is_subset(value, superset[key]):
                return False
        else:
            if superset[key] != value:
                return False
    return True

    
def run_request(req_json, expected_response_subset=dict()):
    print("#### REQUEST ####")
    print(json.dumps(req_json))
    res = requests.post('http://127.0.0.1:9092/jaia/v1', json=req_json)
    assert(res.ok)
    print("#### RESPONSE ####")
    print(json.dumps(res.json()))
    assert(is_subset(expected_response_subset, res.json()))
    print("")

run_request({"target": {"all": True}, "status": True, "api_key": api_key},
            expected_response_subset={"request": {"status": True, "target": {"all": True}}, "status": {}})

run_request({"target": {"all": True}, "metadata": True, "api_key": api_key},
            expected_response_subset={"request": {"metadata": True, "target": {"all": True}}, "metadata": {}})

now_micros = int(datetime.datetime.now().timestamp() * 1e6)
DAY = 1e6 * 60 * 60 * 24 # microseconds in a day

run_request({"target": {"bots": [1]}, "task_packets": {"start_time": now_micros - DAY, "end_time": now_micros + DAY}, "api_key": api_key},
            expected_response_subset={"request": {"task_packets": {}, "target": {"bots": [1]}}, "task_packets": {}})

run_request({"target": {"all": True}, "command": {"type": "STOP"}, "api_key": api_key},
            expected_response_subset={"request": {"command": {"type": "STOP"}, "target": {"all": True}}, "command_result": { "command_sent": True}})

run_request({"target": {"all": True}, "command_for_hub": {"type": "SET_HUB_LOCATION", "hub_location": { "lat": 41.7, "lon": -70.3 }},  "api_key": api_key},
            expected_response_subset={"request": {"command_for_hub": {"type": "SET_HUB_LOCATION"}, "target": {"all": True}}, "command_result": { "command_sent": True}})

# Invalid field: API_ERROR__COULD_NOT_PARSE_API_REQUEST_JSON
run_request({"target": {"bots": [1]}, "foo": True},
            expected_response_subset={"error": {"code": "API_ERROR__COULD_NOT_PARSE_API_REQUEST_JSON"}})

# Not initialized: API_ERROR__REQUEST_NOT_INITIALIZED
run_request({"target": {"all": True}, "command_for_hub": {"type": "SET_HUB_LOCATION", "hub_location": { "lat": 41.7 }},  "api_key": api_key},
            expected_response_subset={"error": {"code": "API_ERROR__REQUEST_NOT_INITIALIZED"}})
