# JaiaBot Data Vision

The JaiaBot Data Vision system is a web server that allows client browsers to plot data graphs and maps, generated from .goby / .h5 files that are stored on the server.

## Quick Start

The system can be built and installed as a systemd service using the following command:

```make```

```
cd jaiabot/src/python
pip install -r requirements.txt
```

## Overview

The Jaiabot Data Vision package is composed of one systemd services: `jaiabot_data_vision.service`.

### jaiabot\_data\_vision.service

This service is a flask app, which implements a REST API for getting log data and data series from the `.h5` files in the `~/jaiabot_data_vision-logs` directory.  It also serves the browser client app, which must be built from React sources.  This client is located in the `client` directory.  The built product is placed into `client/dist`.
