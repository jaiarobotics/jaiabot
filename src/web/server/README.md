# Jaia Web Interface

This is the Flask server (`app.py`) that serves the Jaia Command and Control (JCC) and Jaia Engineering and Debugging (JED) clients and the offline map tiles. The clients talk to the hub through the REST API (`../rest_api`) at `/jaia/v1` on the same origin.

On a hub, Apache routes `/jaia` to the REST API. In the simulator and when running this server directly, `app.py` forwards `/jaia/v1` requests to the REST API server given by `-R`.

## Requirements

The server's Python dependencies (including `flask` and the `dccl` module) are installed into a virtual environment by `src/python/build_venv.sh`, which is invoked automatically by `src/web/run.sh`.

## Running the server

The usual way to run the server (and build/watch the clients) is from `src/web`:

```
./run.sh [hub_hostname]
```

With no _hub_hostname_, requests go to a REST API on `localhost:9092`, as the simulator runs it. Given a _hub_hostname_, they go to that hub's REST API at `http://hub_hostname`.

To run just the server directly:

```
./app.py
```

Useful options (see `./app.py --help` for the full list):

- `-P`: HTTP port for web browser connections (default 40001)
- `-a`: root directory from which to serve the built client apps
- `-R`: REST API server to forward `/jaia/v1` requests to (default `http://localhost:9092`)

Note that `run.sh` derives the HTTP port from `jaia_hub_id` (`web_port = 40000 + hub_id`).

## Browsing to the server

You can access **Jaia Command and Control** at:

<http://web_hostname:40001/>

The **Jaia Engineering and Debugging** interface is at:

<http://web_hostname:40001/jed/>

where _web_hostname_ is the hostname where you're running the `app.py` script, and 40001 is the HTTP port chosen above.
