# Architecture

Preliminary JaiaBot system block diagram:

![Architecture](../figures/jaiabot-software.png)

## Middlewares

`jaiabot` is based primarily on two publish/subscribe asynchronous middlewares:

- Goby3: <https://goby.software/3.0/>
- MOOS-IvP: <http://moos-ivp.org>

Goby3 forms the core of the communications design, providing interthread, interprocess, and intervehicle communications. MOOS-IvP provides the behavior-based autonomy implementation using the `pHelmIvP` multi-objective decision engine.

In addition, we expect to support clients using `ROS` in the future.

## Applications

### Goby Applications

#### In Goby3 project

- `goby_logger`: Subscribes to messages in the gobyd and logs them to the disk.
- `goby_coroner`: Provides health status from the output of each of the Goby applications.
- `goby_ros_gateway`: Gateway to ROS middleware (not yet written).
- `goby_moos_gateway`: Gateway to MOOS applications.
- `goby_gps`: Takes GPS data from `gpsd` and publishes it to the gobyd.
- `goby_opencpn_interface`: Interface from Goby3 to OpenCPN.

#### In jaiabot project

- `jaiabot_health`: Overall system health using data from `goby_coroner` and possibly other sources (TBD?).
- `jaiabot_control`: Feedback controller (PID).
- `jaiabot_power`: Power management and circuit control (if hardware supports this).
- `jaiabot_lights`: Light control (perhaps part of `jaiabot_power` instead?).
- `jaiabot_payload_interface`: Pluggable interface for different payload data feeds to be logged.
- `jaiabot_mission_manager`: Keeps a state machine of the overall mission state and switches from pHelmIvP control to profile mode as required.
- `jaiabot_fusion`: Assembles the `goby::middleware::frontseat::protobuf::NodeStatus` message used by the `goby_moos_gateway` from the `goby_gps` output, pressure sensor, and other sources, as needed.


#### In the MOOS-IvP project

- `pHelmIvP`: Pluggable behavior based autonomy.
- `pNodeReporter`: Aggregates NAV_* variables into NODE_REPORT variable for pHelmIvP.

