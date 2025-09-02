# JaiaBot Battery Health

## Limitations at Battery Levels
| Percentage | Health Warn/Error                      | Limitations |
| ------- |----------------------------------------| ------------|
| 50      | WARNING__VEHICLE__LOW_BATTERY          | No limitations, but operator should be prepared to return bot home                                                     |
| 20   | ERROR__VEHICLE__VERY_LOW_BATTERY       | The bot is unable to dive when it reaches this level. The operator should make it a priority to return home            |
| 10   | ERROR__VEHICLE__CRITICALLY_LOW_BATTERY | The bot is unable to drive at this point, but will continue to transmit its location for retrieval.                               |
