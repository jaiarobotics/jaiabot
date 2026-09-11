# JaiaBot Port Map

All ports are defined in the configuration generators, primarily `jaiabot/config/gen/common/udp.py`, `jaiabot/config/gen/common/bot.py` and `jaiabot/config/gen/common/hub.py`. Where the runtime (in-water) and simulation values differ, both are given below.

In simulation all the nodes may run on a single host, so ports that would otherwise collide are offset by the node id (`node_id` is 0 for the hub and `bot_id + 1` for a bot).

## TCP

| Port | Use |
|------|-----|
| 53 | Fleet DNS (`jaiabot_dns`, hub only) |
| 2947 | GPSD (runtime default) |
| 9000 + node_id | MOOSDB (`moos_port`) |
| 9100 + node_id | MOOSDB for the simulator (`moos_simulator_port`) |
| 30000 | Goby Liaison (runtime, bot and hub) |
| 30010 + hub_id | Goby Liaison (simulation, hub) |
| 30100 + bot_id | Goby Liaison (simulation, bot) |

## UDP

| Port | Use |
|------|-----|
| 53 | Fleet DNS (`jaiabot_dns`, hub only) |
| 20000 | `jaiabot_udp_gateway` (runtime): all the Python sensor drivers (IMU, pressure/temperature, EC, PAM, TSYS01) publish to this single port |
| 20400 + node_id | `jaiabot_udp_gateway` (simulation) |
| 20005 | Python motor driver |
| 31000 | WiFi comms link (runtime) |
| 31000 + hub_id | WiFi comms link to a hub (simulation) |
| 31031 + node_id | WiFi comms link to a bot (simulation; 31000 offset by the maximum number of hubs) |
| 32000 | Hub-to-hub comms link (runtime) |
| 32000 + hub_id | Hub-to-hub comms link and simulated hub GPSD feed (simulation) |
| 32100 + node_id | Simulated bot GPSD feed |
| 33000 + contact_id | GPSD feed for a contact (e.g. AIS/GPS source) |
| 40000 | `jaiabot_web_portal` (runtime) |
| 40001 - hub_id | `jaiabot_web_portal` (single-host simulation) |
