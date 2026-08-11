# Jaia Web Interface

This is the Flask server (`app.py`) that serves the Jaia Command and Control (JCC) and Jaia Engineering and Debugging (JED) clients, and bridges them to `jaiabot_web_portal` over UDP.

## Requirements

The server's Python dependencies (including `flask` and the `dccl` module) are installed into a virtual environment by `src/python/build_venv.sh`, which is invoked automatically by `src/web/run.sh`.

## Running the server

The usual way to run the server (and build/watch the clients) is from `src/web`:

```
./run.sh [hub_hostname]
```

To run just the server directly:

```
./app.py [hub_hostname]
```

where _hub_hostname_ is the name of the machine running `jaiabot_web_portal` (this can be `localhost`, or a remote machine). If omitted, the `JCC_HUB_IP` environmental variable is used, falling back to `localhost`.

Useful options (see `./app.py --help` for the full list):

- `-p`: UDP port used to talk to `jaiabot_web_portal` (default 40000)
- `-P`: HTTP port for web browser connections (default 40001)
- `-a`: root directory from which to serve the built client apps
- `-r`: start a read-only client that cannot send commands

Note that `run.sh` derives both ports from `jaia_hub_id` (`portal_port = 40001 - hub_id`, `web_port = 40000 + hub_id`).

## Browsing to the server

You can access **Jaia Command and Control** at:

<http://web_hostname:40001/>

The **Jaia Engineering and Debugging** interface is at:

<http://web_hostname:40001/jed/>

where _web_hostname_ is the hostname where you're running the `app.py` script, and 40001 is the HTTP port chosen above.
