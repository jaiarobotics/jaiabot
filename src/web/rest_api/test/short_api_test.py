#!/usr/bin/env python3

import requests
import json
import datetime


def run_request(req_json):
    res = requests.post('http://127.0.0.1:9092/jaia/v1', json=req_json)
    assert(res.ok)
    print("#### REQUEST ####")
    print(json.dumps(req_json))
    print("#### RESPONSE ####")
    print(json.dumps(res.json()))

run_request({"target": {"all": True}, "status": True, "api_key": "4vS6s2jnulxVjrKSB-__tQ"})
     

run_request({"target": {"all": True}, "metadata": True, "api_key": "4vS6s2jnulxVjrKSB-__tQ"})


now_micros = int(datetime.datetime.now().timestamp() * 1e6)
DAY = 1e6 * 60 * 60 * 24 # microseconds in a day

#run_request({"target": {"bots": [1]}, "task_packets": {"start_time": now_micros - DAY, "end_time": now_micros + DAY}, "api_key": "4vS6s2jnulxVjrKSB-__tQ"})

run_request({"target": {"all": True}, "command": {"type": "STOP"}, "api_key": "4vS6s2jnulxVjrKSB-__tQ"})

run_request({"target": {"all": True}, "command_for_hub": {"type": "SET_HUB_LOCATION", "hub_location": { "lat": 41.7, "lon": -70.3 }},  "api_key": "4vS6s2jnulxVjrKSB-__tQ"})
