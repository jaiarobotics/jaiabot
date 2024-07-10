#!/usr/bin/env python3

import requests

res = requests.post('http://127.0.0.1:9092/jaia/v1', json={"target": {"all": True}, "status": True})
assert(res.ok)
print(res.json())
