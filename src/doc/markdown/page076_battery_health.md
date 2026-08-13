# JaiaBot Battery Health

## Limitations at Battery Levels
| Percentage | Health Warn/Error                      | Limitations |
| ------- |----------------------------------------| ------------|
| 50      | WARNING__VEHICLE__LOW_BATTERY          | No limitations, but operator should be prepared to return bot home                                                     |
| 20   | ERROR__VEHICLE__VERY_LOW_BATTERY       | The bot is unable to dive when it reaches this level. The operator should make it a priority to return home            |
| 10   | ERROR__VEHICLE__CRITICALLY_LOW_BATTERY | The bot is unable to drive at this point, but will continue to transmit its location for retrieval.                               |

## Battery Imbalance
The Arduino measures the junction of the two series batteries on A6, and the arduino driver
compares the charge of each battery against the other.

| Volts | Health Warn/Error                | Limitations |
| ----- |----------------------------------| ------------|
| 1.0   | ERROR__VEHICLE__BATTERY_IMBALANCE | One battery is more charged than the other, which indicates a failing battery or a bad connection. The threshold is set by `battery_imbalance_max_volts` in the arduino driver configuration. |
