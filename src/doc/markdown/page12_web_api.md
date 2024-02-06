# Web Endpoints

## IP Address

10.23.fleetId.hubId + 10 

Ex: fleetId 10 and hubId: 1

```
10.23.10.11
```

### Bot Status 

#### Description

This endpoint will get the current client that is in control of the JCC, the current hub(s') status, and the current bot(s') status.

#### Example Input

```
10.23.1.11/jaia/status
```

#### Example Python Script

```
# importing the requests library
import requests

API_ENDPOINT = "http://10.23.1.11/jaia/status"

# define the headers for the request
headers = {'clientid': 'backseat-control', 'Content-Type' : 'application/json; charset=utf-8'}

wpt_resp = requests.post(url=API_ENDPOINT, headers=headers)

# extracting response text
pastebin_url = wpt_resp.text
print("The pastebin URL is:%s"%pastebin_url)
```

#### Example Output

The current status for hubs and bots (1 hub and 2 bots)

```
{"controllingClientId": null, "hubs": {"0": {"hub_id": 0, "fleet_id": 0, "time": "8536186149692575", "health_state": "HEALTH__OK", "location": {"lat": 41.66268, "lon": -71.273018}, "bot_ids_in_radio_file": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], "linux_hardware_status": {"wifi": {"is_connected": true, "link_quality": 70, "link_quality_percentage": 100, "signal_level": 33, "noise_level": 0}}, "lastStatusReceivedTime": 1707237229939903, "portalStatusAge": 133638}}, "bots": {"2": {"bot_id": 2, "time": "1707237230000000", "health_state": "HEALTH__OK", "location": {"lat": 41.662075, "lon": -71.272276}, "depth": 0.0, "attitude": {"roll": -57.0, "pitch": 0.0, "heading": 166.0, "course_over_ground": 180.0}, "speed": {"over_ground": 0.0}, "mission_state": "PRE_DEPLOYMENT__IDLE", "salinity": 20.0, "temperature": 15.0, "vcc_voltage": 24.0, "battery_percent": 95.0, "calibration_status": 3, "hdop": 0.87, "pdop": 0.21, "wifi_link_quality_percentage": 100, "lastStatusReceivedTime": 1707237229941392, "portalStatusAge": 132159}, "1": {"bot_id": 1, "time": "1707237230000000", "health_state": "HEALTH__OK", "location": {"lat": 41.66207, "lon": -71.272276}, "depth": 0.0, "attitude": {"roll": -57.0, "pitch": 0.0, "heading": 166.0, "course_over_ground": 180.0}, "speed": {"over_ground": 0.0}, "mission_state": "PRE_DEPLOYMENT__IDLE", "salinity": 20.0, "temperature": 14.97, "vcc_voltage": 24.0, "battery_percent": 95.0, "calibration_status": 3, "hdop": 0.06, "pdop": 0.11, "wifi_link_quality_percentage": 100, "lastStatusReceivedTime": 1707237229941623, "portalStatusAge": 131929}}, "messages": {}}
```

### Task Packets

#### Description

This endpoint will get the all of the task packets available or a subset of task packets based off a start date and a end data.

#### Example Input

This will get all the available task packets:

```
10.23.1.11/jaia/task-packets
```

This will get a subset of the available task packets:

Date Format: yyyy-mm-dd hh:mm:ss
Timezone: GMT

```
10.23.1.11/jaia/task-packets?startDate="2023-10-18 09:04:00"&endDate="2023-10-22 09:04:00"
```

#### Example Python Script

```
# importing the requests library
import requests

API_ENDPOINT = "http://10.23.1.11/jaia/task-packets"

# define the headers for the request
headers = {'clientid': 'backseat-control', 'Content-Type' : 'application/json; charset=utf-8'}

wpt_resp = requests.post(url=API_ENDPOINT, headers=headers)

# extracting response text
pastebin_url = wpt_resp.text
print("The pastebin URL is:%s"%pastebin_url)
```

#### Example Output

```
[{"bot_id": 2, "start_time": "1707223526000000", "end_time": "1707223602000000", "type": "DIVE", "dive": {"dive_rate": 0.5, "unpowered_rise_rate": 0.2, "depth_achieved": 2.0, "measurement": [{"mean_depth": 2.0, "mean_temperature": 14.9, "mean_salinity": 20.0}], "start_location": {"lat": 41.661825, "lon": -71.27313}, "duration_to_acquire_gps": 30.4, "bottom_dive": false}, "drift": {"drift_duration": 20, "estimated_drift": {"speed": 0.3, "heading": 180.0}, "start_location": {"lat": 41.661734, "lon": -71.273127}, "end_location": {"lat": 41.661687, "lon": -71.273125}, "significant_wave_height": 1.5}}, {"bot_id": 1, "start_time": "1707223525000000", "end_time": "1707223603000000", "type": "DIVE", "dive": {"dive_rate": 0.5, "unpowered_rise_rate": 0.2, "depth_achieved": 2.0, "measurement": [{"mean_depth": 2.0, "mean_temperature": 14.9, "mean_salinity": 20.0}], "start_location": {"lat": 41.661824, "lon": -71.27313}, "duration_to_acquire_gps": 31.6, "bottom_dive": false}, "drift": {"drift_duration": 20, "estimated_drift": {"speed": 0.3, "heading": 180.0}, "start_location": {"lat": 41.66173, "lon": -71.273127}, "end_location": {"lat": 41.661684, "lon": -71.273125}, "significant_wave_height": 1.5}}]
```

### Task Packet Count

#### Description

This endpoint will get the total number of task packets available.

#### Example Input

```
10.23.1.11/jaia/task-packets-count
```

#### Example Python Script

```
# importing the requests library
import requests

API_ENDPOINT = "http://10.23.1.11/jaia/task-packets-count"

# define the headers for the request
headers = {'clientid': 'backseat-control', 'Content-Type' : 'application/json; charset=utf-8'}

wpt_resp = requests.post(url=API_ENDPOINT, headers=headers)

# extracting response text
pastebin_url = wpt_resp.text
print("The pastebin URL is:%s"%pastebin_url)
```

#### Example Output

```
1
```

### Metadata

#### Description

This endpoint will get the metadata associated with the software that the hub is currently running. The version of the jaiabot, goby, and moos software. It will also include the hub's radio configurations.

#### Example Input

```
10.23.1.11/jaia/metadata
```

#### Example Python Script

```
# importing the requests library
import requests

API_ENDPOINT = "http://10.23.1.11/jaia/metadata"

# define the headers for the request
headers = {'clientid': 'backseat-control', 'Content-Type' : 'application/json; charset=utf-8'}

wpt_resp = requests.post(url=API_ENDPOINT, headers=headers)

# extracting response text
pastebin_url = wpt_resp.text
print("The pastebin URL is:%s"%pastebin_url)
```

#### Example Output

```
{"name": "LAPTOP-AH3AN14A", "jaiabot_version": {"major": "1", "minor": "8", "patch": "0+0+g6aa16a20-dirty", "git_hash": "6aa16a201d9cd61156380db58263469b7261a2cb-dirty", "git_branch": "task/document-web-api-endpoints"}, "goby_version": "3.1.3", "moos_version": "10.4.0", "xbee_node_id": "0", "xbee_serial_number": "0x0013a20041e91eef"}
```

### Single Waypoint Mission

#### Description

This endpoint will send a single waypoint mission to one or all bots that are currently connected to the hub. 

#### Example Python Script

Required data for the single waypoint mission is lat and lon.

Optional:
* A bot_id, if not included then the waypoint is sent to all the bots
* A task for the bot to perform at the waypoint
* A speed for the bot, if not include it will use default = {'transit': 2, 'stationkeep_outer': 1.5}

```
# importing the requests library
import requests

API_ENDPOINT = "http://10.23.1.11/jaia/single-waypoint-mission"

# define the headers for the request
headers = {'clientid': 'backseat-control', 'Content-Type' : 'application/json; charset=utf-8'}

data = {'lat': 41.661849, 'lon': -71.273131}

# data = {'bot_id': 1, 'lat': 41.661849, 'lon': -71.273131, 'dive_depth': 2, 'surface_drift_time': 15,'transit_speed': 2.5, 'station_keep_speed': 0.5}
# data = {'lat': 41.661849, 'lon': -71.273131, 'dive_depth': 2, 'surface_drift_time': 15,'transit_speed': 2.5, 'station_keep_speed': 0.5}  
# data = {'lat': 41.661849, 'lon': -71.273131, 'dive_depth': 2,'transit_speed': 2.5, 'station_keep_speed': 0.5}
# data = {'lat': 41.661849, 'lon': -71.273131, 'surface_drift_time': 15, 'transit_speed': 2.5, 'station_keep_speed': 0.5}
# data = {'lat': 41.661849, 'lon': -71.273131, 'station_keep_speed': 2}
# data = {'lat': 41.661849, 'lon': -71.273131, 'transit_speed': 3}

wpt_resp = requests.post(url=API_ENDPOINT, json=data, headers=headers)

# extracting response text
pastebin_url = wpt_resp.text
print("The pastebin URL is:%s"%pastebin_url)
```

### Stop All Bots

#### Description

This endpoint will send a stop command to all bots that are currently connected to the hub. 

#### Example Python Script

```
# importing the requests library
import requests

API_ENDPOINT = "http://10.23.1.11/jaia/all-stop"

# define the headers for the request
headers = {'clientid': 'backseat-control', 'Content-Type' : 'application/json; charset=utf-8'}

wpt_resp = requests.post(url=API_ENDPOINT, headers=headers)

# extracting response text
pastebin_url = wpt_resp.text
print("The pastebin URL is:%s"%pastebin_url)
```

### Activate All Bots

#### Description

This endpoint will send an activate command to all bots that are currently connected to the hub. 

#### Example Python Script

```
# importing the requests library
import requests

API_ENDPOINT = "http://10.23.1.11/jaia/all-activate"

# define the headers for the request
headers = {'clientid': 'backseat-control', 'Content-Type' : 'application/json; charset=utf-8'}

wpt_resp = requests.post(url=API_ENDPOINT, headers=headers)

# extracting response text
pastebin_url = wpt_resp.text
print("The pastebin URL is:%s"%pastebin_url)
```