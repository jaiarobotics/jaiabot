To test the sensor, you can run:

   ```bash
   ./jaiabot_pressure_sensor.py
   ```

This publishes `PressureTemperatureData` to the `jaiabot_udp_gateway` UDP port (default 20000). To watch the output without the gateway running, listen on that port with:

   ```bash
   nc -u -l 20000
   ```

Use `-p`/`--udp_gateway_port` to send to a different port, and `-l DEBUG` for more verbose logging. See `./jaiabot_pressure_sensor.py --help` for all options.
