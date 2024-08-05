#!/usr/bin/env python3

import requests
import os
import datetime
from pprint import pprint

try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
except KeyError:
    api_key=""

now_micros = int(datetime.datetime.now().timestamp() * 1e6)
DAY = 1e6 * 60 * 60 * 24 # microseconds in a day

res = requests.post('http://127.0.0.1:9092/jaia/v1', json={"target": {"all": False, "bots": [1]}, "task_packets": {"start_time": now_micros - DAY, "end_time": now_micros + DAY}, "api_key": api_key})
assert(res.ok)
pprint(res.json())
