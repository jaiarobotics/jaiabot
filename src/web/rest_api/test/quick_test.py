import requests
import datetime
import json

# This file is meant for quick tests

api_key=""


def run_request(req_json):
    print("#### REQUEST ####")
    print(json.dumps(req_json))

    http='http'
    api_host='localhost'
    api_port=9092

    res = requests.post(f'{http}://{api_host}:{api_port}/jaia/v1', json=req_json)
    assert(res.ok)
    print("#### RESPONSE ####")
    print(json.dumps(res.json()))
    print("")


now_micros = int(datetime.datetime.now().timestamp() * 1e6)
DAY = 1e6 * 60 * 60 * 24 # microseconds in a day

run_request({"target": {"all": True, "bots": [1]}, "task_packets": {"start_time": 1, "end_time": now_micros * 10}, "api_key": api_key})
