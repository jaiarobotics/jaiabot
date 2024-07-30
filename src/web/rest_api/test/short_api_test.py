#!/usr/bin/env python3

import requests

res = requests.post('http://127.0.0.1:9092/jaia/v1', json={"target": {"all": True}, "status": True, "api_key": "4vS6s2jnulxVjrKSB-__tQ"})
assert(res.ok)
print(res.json())
