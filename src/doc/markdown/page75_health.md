# Health Reporting

The health of the bots and hubs is monitored by `jaiabot_health` which uses the framework from Goby (which is aggregated by  `goby_coroner`)

## goby_coroner

Every 10 seconds `goby_coroner` publishes `goby::health::request` (an empty message) that is subscribed to by all goby Multi- and SingleThreadApplications. For MultiThreadApplications, the main thread then queries all threads internally in a similar fashion. 

Each application or thread can overload the virtual method `health` to implement their response to this request:

```
virtual void health(goby::middleware::protobuf::ThreadHealth& health) override
```

The parameter `health` (a [ThreadHealth](https://goby.software/3.0/classgoby_1_1middleware_1_1protobuf_1_1ThreadHealth.html) Protobuf message) can be modified to include the desired response. At a minimum, the `state` field should be set to one of these:
-  `HEALTH_OK`: Nominally functioning operation
-  `HEALTH_DEGRADED`: Something is going wrong but it isn't critical
-  `HEALTH_FAILED`: Something critical has gone wrong.

If the `health` method isn't overloaded, each thread responds with `HEALTH_OK`, which serves as a "heartbeat" for all apps and threads. However, where possible, applications should provide more detailed information (e.g. state of connected sensors for drivers, etc.). This aggregate health data from all threads is published interprocess as `goby::health::response`.

`goby_coroner` batches all the `health::response` messages from all apps that it is configured to watch `(--expected_name)` and puts them into a report (`goby::health::report`, type [VehicleHealth](https://goby.software/3.0/classgoby_1_1middleware_1_1protobuf_1_1VehicleHealth.html)). The report includes a top level `state` that is the worst of any of the reported app states (that is, if one app is DEGRADED, the system is considered DEGRADED; if one app is FAILED, the system is considered FAILED). Only if all apps are OK, is the system considered OK.

## jaiabot_health

`jaiabot_health` subscribes to the `goby::health::report` produced by `goby_coroner` and uses it as the basis for jaiabot-specific reporting.

Since `goby::health::report` is a large and variable message with strings, we want to produce a specialized set of enumerated errors (which correspond to the `HEALTH_FAILED` state) and warnings (which correspond to `HEALTH_DEGRADED`) as well. These are defined in `health.proto` as a Protobuf extension to goby::middleware::protobuf::ThreadHealth (the message used in the virtual `health()` method). 

Different apps set the enumerations that are appropriate for that app's function. These are grouped in rough "families":

- `ERROR__FAILED__*` (*not yet implemented*): The systemd service for this app failed.
- `ERROR__NOT_RESPONDING__*`: The Goby app did not respond to the last goby_coroner request. (This often overlaps with `ERROR__FAILED__*` but not necessarily; e.g. if an app is still running but hangs.)
- `ERROR|WARNING__MISSING_DATA__*`  (*not yet implemented*): A particular required or expected data stream is missing at `jaiabot_fusion`.
- `ERROR|WARNING__COMMS__*`  (*not yet implemented*): Communications related errors or warnings.
- `ERROR__MOOS__*`  (*not yet implemented*): MOOS app related errors
- `ERROR|WARNING__SYSTEM__*`  (*not yet implemented*): System related errors or warnings (memory, disk, cpu, etc.)
- `ERROR|WARNING__VEHICLE__*`  (*not yet implemented*)`: Vehicle level errors or warnings (low battery, thruster, etc.)

### Restart functionality 

`jaiabot_health` can be set to automatically restart all the jaiabot services if a period of time elapses with no HEALTH_OK report:

```
# enables auto restart on no HEALTH_OK
auto_restart: true  
#  how long we must go without a HEALTH_OK report until restarting
auto_restart_timeout: 20 
#  how long to wait for the first health report
auto_restart_init_grace_period: 60  
```

### Powerstate functionality

Since `jaiabot_health` is run as root to allow it to restart the services, it is all the place that handles the system level powerstate changes (reboot or shutdown).

For simulation purposes, this is disabled to avoid powering off the development computer using:

```
ignore_powerstate_changes: true
```

## jaiabot_fusion 

The enumerations written by jaiabot_health and other jaiabot apps are very suitable for inclusion in the BotStatus DCCL message, and up to 5 each of errors and warnings are included by `jaiabot_fusion` for display in Central Command. If more errors or warnings exist, the excess ones are omitted and `ERROR__TOO_MANY_ERRORS_TO_REPORT_ALL` and/or `WARNING__TOO_MANY_WARNINGS_TO_REPORT_ALL` are added to the list.
