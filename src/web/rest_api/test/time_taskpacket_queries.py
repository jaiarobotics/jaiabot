#!/usr/bin/env python3

import requests
import json
import datetime
import os
import argparse
from time import time


try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
except KeyError:
    api_key=""

parser = argparse.ArgumentParser(description="Time the task packet queries to the database.")
parser.add_argument('--api_host', type=str, default="127.0.0.1", help='The API host')
parser.add_argument('--api_port', type=int, default=9092, help='The API port')
parser.add_argument('--https', action='store_true', help='Use HTTPS')
parser.add_argument('--https-skip-verify', action='store_true', help='Skip https verification')

args = parser.parse_args()

verify=True
if args.https_skip_verify:
    verify=False


def run_request(req_json):
    print("#### REQUEST ####")
    print(json.dumps(req_json))

    http='http'
    if args.https or args.api_port == 443:
        http='https'
    
    start = time()
    res = requests.post(f'{http}://{args.api_host}:{args.api_port}/jaia/v1', json=req_json, verify=verify)
    end = time()

    assert res.ok, f"Request failed with status code {res.status_code} and message {res.text}"

    print(f"Response time = {end - start} seconds")
    print(res.json())


# Test and time the task packet endpoint
now_micros = int(datetime.datetime.now().timestamp() * 1e6)
DAY = 1e6 * 60 * 60 * 24 # microseconds in a day

queries = [
    # {"target": {"bots": [1]}, "task_packets": {"start_time": now_micros - 0.1 * DAY, "end_time": now_micros + DAY}, "api_key": api_key},
    # {"target": {"bots": [1]}, "task_packets": {"start_time": now_micros - 0.2 * DAY, "end_time": now_micros + DAY}, "api_key": api_key},
    # {"target": {"bots": [1]}, "task_packets": {"start_time": now_micros - 0.5 * DAY, "end_time": now_micros + DAY}, "api_key": api_key},
    # {"target": {"bots": [1]}, "task_packets": {"start_time": now_micros - 1 * DAY, "end_time": now_micros + DAY}, "api_key": api_key},
    # {"target": {"bots": [1]}, "task_packets": {"start_time": now_micros - 50 * DAY, "end_time": now_micros + DAY}, "api_key": api_key},
    {"target": {"bots": [1]}, "task_packets": {"mission_name": "Ed Test Mission 3"}, "api_key": api_key},
]

for query in queries:
    run_request(query)

