#!/usr/bin/env python3

import requests
import os

try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
except KeyError:
    api_key=""

res = requests.post('http://127.0.0.1:9092/jaia/v1', json={"target": {"all": True}, "task_packets": {"start_date": "2024-01-01 00:00:00", "end_date": "2024-07-26 13:00:00"}, "api_key": api_key})
assert(res.ok)
print(res.json())
