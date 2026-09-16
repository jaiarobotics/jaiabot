To test the sensor, run the driver against a running `gobyd`:

   ```bash
   jaiabot_driver_pressure.py -C 'jaia dev gen bot.py jaiabot_driver_pressure'
   ```

It publishes `PressureTemperatureData` on the `jaiabot::pressure_temperature` group. To watch
the output, subscribe to that group with `goby_liaison`, or raise the driver's own verbosity:

   ```bash
   jaiabot_driver_pressure.py -C '...' --app 'glog_config { tty_verbosity: DEBUG1 }'
   ```

Set `simulate: true` in the configuration to take readings from `jaiabot_simulator`'s water
column instead of hardware. See `jaiabot_driver_pressure.py --help` for all options.
