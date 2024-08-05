#!/usr/bin/env python3

import requests
import os
import json
import datetime
import argparse

try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
except KeyError:
    api_key=""


parser = argparse.ArgumentParser(description="Parse API host and port from command line.")
parser.add_argument('--api_host', type=str, default="127.0.0.1", help='The API host')
parser.add_argument('--api_port', type=int, default=9092, help='The API port')

args = parser.parse_args()
    
    
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

def run_request(url_path, get_vars='', post_json='', expected_response_subset=dict()):

    base_url=f'http://{args.api_host}:{args.api_port}/jaia/v1'
    url = base_url + url_path
    if get_vars:
        print("#### GET REQUEST ####")
        print(url + get_vars)
        res = requests.get(url + get_vars)
        assert(res.ok)
        print("#### GET RESPONSE ####")
        print(json.dumps(res.json()))
        assert(is_subset(expected_response_subset, res.json()))

    if post_json:
        print("#### POST REQUEST ####")
        print(url)
        print(json.dumps(post_json))
        res = requests.post(url, json = post_json)
        assert(res.ok)
        print("#### POST RESPONSE ####")
        print(json.dumps(res.json()))
        print("")
        assert(is_subset(expected_response_subset, res.json()))


        
    
now_micros = int(datetime.datetime.now().timestamp() * 1e6)
DAY = 1e6 * 60 * 60 * 24 # microseconds in a day


run_request('/status/all',
            get_vars=f'?api_key={api_key}',
            post_json={"api_key": api_key},
            expected_response_subset={"request": {"status": True, "target": {"all": True}}, "status": {}})

run_request('/metadata/all',
            get_vars=f'?api_key={api_key}',
            post_json={"api_key": api_key},
            expected_response_subset={"request": {"metadata": True, "target": {"all": True}}, "metadata": {}})

now_micros = int(datetime.datetime.now().timestamp() * 1e6)
DAY = 1e6 * 60 * 60 * 24 # microseconds in a day

run_request('/task_packets/b2',
            f'?api_key={api_key}&start_time={int(now_micros - DAY)}&end_time={int(now_micros +  DAY)}',
            post_json={"start_time": now_micros - DAY, "end_time": now_micros + DAY, "api_key": api_key},
            expected_response_subset={"request": {"task_packets": {}, "target": {"bots": [2]}}, "task_packets": {}})


run_request('/command/b1',
            get_vars=f'?api_key={api_key}&type=STOP',
            post_json={"type": "STOP", "api_key": api_key},
            expected_response_subset={"request": {"command": {"type": "STOP"}, "target": {"bots": [1]}}, "command_result": { "command_sent": True}})

run_request('/command/b1',
            post_json={"api_key": api_key, "type":"MISSION_PLAN","plan":{"goal":[{"location":{"lat":41.661849,"lon":-71.273131},"task":{"type":"DIVE","dive":{"max_depth":2},"surface_drift":{"drift_time":15}}}],"speeds":{"transit":2.5,"stationkeep_outer":0.5}}},
            expected_response_subset={"request": {"command": {"type": "MISSION_PLAN"}, "target": {"bots": [1]}}, "command_result": { "command_sent": True}})

run_request('/command_for_hub/h1' ,
            post_json={"type": "SET_HUB_LOCATION", "hub_location": { "lat": 41.7, "lon": -70.3 }, "api_key": api_key},
            expected_response_subset={"request": {"command_for_hub": {"type": "SET_HUB_LOCATION"}, "target": {"hubs": [1]}}, "command_result": { "command_sent": True}})


# invalid enum: API_ERROR__COULD_NOT_PARSE_API_REQUEST_JSON
run_request('/command/b1',
            get_vars=f'?api_key={api_key}&type=FOO',
            post_json={"type": "FOO", "api_key": api_key},
            expected_response_subset={"error": {"code": "API_ERROR__COULD_NOT_PARSE_API_REQUEST_JSON"}})

# invalid int type: API_ERROR__INVALID_TYPE
run_request('/task_packets/b2',
            get_vars=f'?api_key={api_key}&start_time={float(now_micros - DAY)}&end_time={float(now_micros +  DAY)}',
            expected_response_subset={"error": {"code": "API_ERROR__INVALID_TYPE"}})

# invalid target string: API_ERROR__INVALID_TARGET
run_request('/task_packets/abcd',
            get_vars=f'?api_key={api_key}',
            expected_response_subset={"error": {"code": "API_ERROR__INVALID_TARGET"}})
