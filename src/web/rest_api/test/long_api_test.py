#!/usr/bin/env python3

import requests

res = requests.post('http://127.0.0.1:5000/jaia/v1/status/all')
assert(res.ok)
print(res.json())


res = requests.post('http://127.0.0.1:5000/jaia/v1/command/b1', json={"bot_id": 0, "time": 0, "type": "STOP"})
assert(res.ok)
print(res.json())
