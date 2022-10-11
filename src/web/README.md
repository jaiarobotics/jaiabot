# Jaia Web Interface

There are three components comprising the Jaia Web Interface.  These are described in the following sections.

## Command Control

Command Control is the main map page, which allows the user to define new missions by clicking to define waypoints, etc.  This web app is written in JavaScript and uses the React and OpenLayers libraries.  Command Control must be built as follows:

```
cd command_control
./build.sh
```

This will place the product into the `command_control/dist/client` directory.

## Engineering

This is the Engineering interface, which can send engineering commands to directly control the motor and control surfaces of the JaiaBots.  It also provides a direct interface to the PID control loops for the throttle, rudder, and elevators.  It is written in pure JavaScript, and doesn't need to be built.

## Flask Server

In the `server` directory  is the `app.py` program, which uses the Flask module to route endpoints to the user's browser.  This app serves the Command Control and Engineering interfaces, as well as the backend REST API that they both access.  This backend REST API, in turn, interfaces with a remote or local `jaiabot_web_portal` application via UDP.  The app is started like this:

```
cd server
./app.py [hostname where jaiabot_web_portal is running]
```

The server requires the `build_messages.sh` script to be run, in order to build the _jaiabot.protobuf.*_ python modules.  These modules are used to serialize and deserialize the Jaia Goby messages for transmission via UDP.
