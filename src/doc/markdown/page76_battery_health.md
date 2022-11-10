# JaiaBot Battery Health

## Limitations at Battery Levels
| Voltage | Health Warn/Error                      | Limitations |
| ------- |----------------------------------------| ------------|
| 20      | WARNING__VEHICLE__LOW_BATTERY          | No limitations, but operator should be prepared to return bot home                                                     |
| 18.75   | ERROR__VEHICLE__VERY_LOW_BATTERY       | The bot is unable to dive when it reaches this level. The operator should make it a priority to return home            |
| 17.75   | ERROR__VEHICLE__CRITICALLY_LOW_BATTERY | The bot is unable to drive at this point so the operator needs to go and pick up the bot                               |