To test the sensor, you can run:

   ```bash
   ./pressure_sensor.py
   ```

For it to print any output, it needs to be queried. This can be done with:

   ```bash
   nc -u localhost 20001
   ```
   
At the netcat prompt, you need to send any kind of data - just hitting enter is enough.
