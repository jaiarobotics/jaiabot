# JaiaBot Data Vision

The JaiaBot Data Vision system is a web server that allows client browsers to plot data graphs and maps, generated from .goby / .h5 files that are stored on the server.

## Quick Start

The system can be built and installed as a systemd service using the following command:

```make install```

```
cd jaiabot/jdv
pip install -r requirements.txt
```

## Overview

The Jaiabot Data Vision package is composed of two systemd services:  `jaiabot_log_converter.service` and `jaiabot_data_vision.service`.

### jaiabot\_log\_converter.service

This service watches a directory (`~jaiabot_data_vision-logs` by default) for incoming `.goby` files to convert.  When a new one arrives in that directory, it will call `goby_log_tool` to convert that file to a `.h5` file for reading by `jaiabot_data_vision`.

### jaiabot\_data\_vision.service

This service is a flask app, which implements a REST API for getting log data and data series from the `.h5` files in the `~/jaiabot_data_vision-logs` directory.  It also serves the browser client app, which must be built from React sources.  This client is located in the `client` directory.  The built product is placed into `client/dist`.
