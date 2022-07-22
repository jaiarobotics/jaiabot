# Configuration

The jaiabot configuration files can be found in the `jaiabot/config` folder of the repository.

At it's simplest, you can simulate any 10 vehicles at 20x real speed by running:

```
./generate_all_launch.sh 10 20
./all.launch
```

And type CTRL+C in that terminal to cleanly shutdown after you're done.

## Overview

The configuration folder is more than simply flat configuration files. Rather, it is a configuration generation tool box that allows for:

- Easy switching from simulation to in-water ("runtime") configuration with minimal changes and maximum overlap of configuration.
- Reuse of configuration file components for different vehicle ids and eventually types.
- Reuse of common configuration between bot and hub shared code.

### Directory structure

- `jaiabot/config`
    - gen: Configuration Generators (in Python3)
        - `bot.py`: Generator for the AUVs' application configuration
        - `hub.py`: Generator for the topside applications.
        - `moos_gen.sh`: Shell script for generating temporary .moos and .bhv files until killed, at which point it cleans up these temporary files. Required since MOOS applications can't read configuration files by process substitution (`<(...) syntax`).
        - `systemd-local.sh`: A frontend to run the python systemd script in this folder
        - `systemd.py`:  Generator for setting up systemd daemons to run the software automatically on a platform
        - `wireguard.py`: Generator for setting up the Wireguard VPN service
        - common: Generator helper module
            - `__init__.py`: Module initialization checks and functions.
            - `comms.py`: Vehicle-to-vehicle or vehicle-to-shore comms configuration parameters
            - `config.py`: General configuration helper functions
            - `hub.py`: Topside specific parameters
            - `origin.py`: Latitude / longitude origin settings for local geodetic conversions.
            - `sim.py`: Simulation specific parameters (warp factor)
            - `udp.py`: Sets the udp ports to use. Mostly for our Python scripts to interact with Goby3 apps.
            - `vehicle.py`: AUV specific parameters
    - templates: Template files used by the [Python String Template][python-template] class to create the final configuration output.
        - `*.pb.cfg.in`: Template files that are common (used by both the bots and the hub)
        - `bot/*.pb.cfg.in`: Template files that are just used by the bots
        - `etc/*.conf.in`: Template for Wireguard VPN
        - `hub/*.pb.cfg.in`: Template files that are just used by the hub.
        - `systemd/*.service.in`: Template files for systemd services to run the system.
    - launch/simulation:  Mission launch files (simulation only, runtime is managed by `systemd`), launched by the `goby_launch` tool.
        - `all.launch`: Launch hub and all vehicles by calling bot.launch for each vehicle and hub.launch.
        - `bot.launch`: Launch a single bot.
        - `hub.launch`: Launch the hub code (topside).
        - `generate_all_launch.sh`: Convenience script for regenerating the `all.launch` file with with a certain number of vehicles and set the time warp (multiple of the real wall time that the simulation clock runs). Usage: `./generate_all_launch.sh {n_bots} {warp}`, e.g. for 5 bots at warp 10x: `./generate_all_launch.sh 5 10`
    - `preseed.goby`: Shell script that is `source`d by the `goby_launch` bash script tool before launching any applications so that all variables that are marked `export` in this script are available to the Python generators and the applications themselves.

[python-template]: https://docs.python.org/3/library/string.html#template-strings

## Implementation: Templates

The configuration file format read by the binaries run on the jaiabot depend on the middleware in use:

- Goby3: Protobuf Text Format using the `goby::middleware::ProtobufConfigurator` configuration tool. To see an example, run any application with the `-e` flag, e.g. `gobyd -e`. Each application has its own configuration file, but many blocks are shared between the applications, e.g. the `interprocess {}` block.
- MOOS: Custom [.moos file][moosfile] syntax.
- IvP Behaviors: Custom [.bhv file][bhvfile] syntax. This is only used by the `pHelmIvP` MOOS application.

[moosfile]: https://oceanai.mit.edu/ivpman/pmwiki/pmwiki.php?n=Helm.MOOSOverview#moos_config
[bhvfile]: https://oceanai.mit.edu/ivpman/pmwiki/pmwiki.php?n=Helm.HelmAutonomy#bhv_params


## Implementation: Generators

The Generator scripts (`gen/*.py`) take a variety of environmental variables and the name of the desired output application as an argument and produce the desired configuration file to standard output.

For example, `gen/bot.py gobyd` returns the configuration for the `gobyd` application running on the bot.

Generally you will need to `source preseed.goby` before running any of these Generators manually.

## Environmental variables

These environmental variables are set in the `preseed.goby` file (`goby_launch` runs `source preseed.goby` before launching any applications) or in the systemd service jobs:

- `jaia_log_dir`: Path to directory base for logging. Within this directory, a substructure will be created by the generator scripts:
    - bot/0: Logs for bot index 0
    - bot/{N}: Logs for bot index {N}
    - hub: Logs for the hub
- `goby3_lib_dir`: Directory where the libraries for Goby3 are stored. Used to dynamically load protobuf messages from the Goby3 libraries.
- `jaia_lib_dir`: Directory to the libraries for `jaiabot`.
- `LD_LIBRARY_PATH`: Directories to add to the load library path (e.g. used by `dlopen` to dynamically load libraries).
- `jaia_max_number_vehicles`: Maximum number of vehicles to configure communications links for (could be greater than the number actually being run).
- `jaia_n_bots`: Number of vehicles to actually run
- `jaia_mode`: "simulation" (for simulation) or "runtime" (for in-water/bench testing)
- `jaia_bot_index`: bot identification number (starting at 0).

## Debugging

By default, all the `.launch` scripts run each application in a GNU `screen` session (detached to start). You can "attach" a terminal window to a screen session with `screen -r`, e.g. `screen -r bot0.gobyd`. To detach and leave the application running, type `CTRL+A D` in the attached terminal window.

### For applications that fail to launch

If you set `-L` for `goby_launch`, it will write a file to `/tmp/goby_launch_screen_*` that will persist after each run. These files show the terminal output for each application, which is useful for debugging failed launches. You can also generate the configuration manually to ensure it is accurate using, for example:

```
source preseed.goby
./gen/bot.py gobyd
```

 You can run any applications on the command line using the same syntax in the .launch file, e.g.

```
source preseed.goby
gobyd <(gen/bot.py gobyd)
```

One useful strategy is to comment-out (#) the application that is having trouble from the .launch file, and then run it with the remaining applications. Once those are running, start the application on the command line manually using the commented-out syntax.


