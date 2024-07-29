#!/usr/bin/env python3

import requests
import os
import datetime

try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
except KeyError:
    api_key=""

now_micros = int(datetime.datetime.now().timestamp() * 1e6)
DAY = 1e6 * 60 * 60 * 24 # microseconds in a day

res = requests.post('http://127.0.0.1:9092/jaia/v1', json={"target": {"all": True}, "task_packets": {"start_date": now_micros - DAY, "end_date": now_micros + DAY}, "api_key": api_key})
assert(res.ok)
print(res.json())
