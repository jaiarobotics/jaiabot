# Jaia Web Interface

## Requirements

In addition to the `flask` module, You need to have the python`dccl` module installed:

```
git clone https://github.com/GobySoft/dccl.git
cd dccl
./build.sh
cd python
./presetup.sh
pip3 install .
```

## Running the server

To run the Jaia web interface, run the following command:

`./app.py hub_hostname`

where _hub_hostname_ is the name of the machine running the hub script:

`jaiabot/config/launch/pid-control-web/hub.launch`

This can be localhost, or a remote machine.

## Browsing to the server

You can access the **Jaia Command and Control** at:

<http://web_hostname:3000/>

The **Engineering** interface will be present at:

<http://web_hostname:3000/pid/>

where _web_hostname_ is the hostname where you're running the app.py script.
