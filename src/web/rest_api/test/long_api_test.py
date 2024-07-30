#!/usr/bin/env python3

import requests

res = requests.post('http://127.0.0.1:9092/jaia/v1/status/all', json={"api_key": "4vS6s2jnulxVjrKSB-__tQ"})
assert(res.ok)
print(res.json())

res = requests.post('http://127.0.0.1:9092/jaia/v1/command/b1', json={"type": "STOP", "api_key": "4vS6s2jnulxVjrKSB-__tQ"})
assert(res.ok)
print(res.json())

#!/usr/bin/env python3
import requests
res = requests.post('http://127.0.0.1:9092/jaia/v1/command/b1', json={"api_key": "4vS6s2jnulxVjrKSB-__tQ", "type":"MISSION_PLAN","plan":{"goal":[{"location":{"lat":41.661849,"lon":-71.273131},"task":{"type":"DIVE","dive":{"max_depth":2},"surface_drift":{"drift_time":15}}}],"speeds":{"transit":2.5,"stationkeep_outer":0.5}}})
assert(res.ok)
print(res.json())
