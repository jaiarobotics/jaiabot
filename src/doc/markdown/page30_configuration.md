# Configuration

The jaiabot configuration files are managed in a separate repository (<https://github.com/jaiarobotics/jaiabot-configuration>). These files are kept separate from the source code so that they can be readily updated on the vehicles using Git while separately managing the compiled source code using APT.

At it's simplest, you can simulate any 10 vehicles at 20x real speed by running:

```
./generate_all_launch.sh 10 20
./all.launch
```

And type CTRL+C in that terminal to cleanly shutdown after you're done.

## Overview

The `jaiabot-configuration` repository is more than simply flat configuration files. Rather, it is a configuration generation tool box that allows for:

- Easy switching from simulation to in-water ("runtime") configuration with minimal changes and maximum overlap of configuration.
- Reuse of configuration file components for different vehicle ids and eventually types.
- Reuse of common configuration between AUV and topside shared code.

### Directory structure

- jaiabot-configuration
    - gen: Configuration Generators (in Python3)
        - `auv.py`: Generator for the AUVs' application configuration
        - `topside.py`: Generator for the topside applications.
        - `moos_gen.sh`: Shell script for generating temporary .moos and .bhv files until killed, at which point it cleans up these temporary files. Required since MOOS applications can't read configuration files by process substitution (`<(...) syntax`).
        - common: Generator helper module
            - `__init__.py`: Module initialization checks and functions.
            - `comms.py`: Vehicle-to-vehicle or vehicle-to-shore comms configuration parameters
            - `config.py`: General configuration helper functions
            - `origin.py`: Latitude / longitude origin settings for local geodetic conversions.
            - `sim.py`: Simulation specific parameters (warp factor)
            - `topside.py`: Topside specific parameters
            - `vehicle.py`: AUV specific parameters
    - templates: Template files used by the [Python String Template][python-template] class to create the final configuration output.
        - `*.pb.cfg.in`: Template files that are common (used by both the AUVs and the topside)
        - `auv/*.pb.cfg.in`: Template files that are just used by the AUVs
        - `topside/*.pb.cfg.in`: Template files that are just used by the topside.
    - `*.launch`: Mission launch files (simulation only, runtime is managed by `systemd`), launched by the `goby_launch` tool.
        - `all.launch`: Launch topside and all vehicles by calling auv.launch for each vehicle and topside.launch.
        - `auv.launch`: Launch a single AUV.
        - `topside.launch`: Launch the base station code (topside).
    - `generate_all_launch.sh`: Convenience script for regenerating the `all.launch` file with with a certain number of vehicles and set the time warp (multiple of the real wall time that the simulation clock runs). Usage: `./generate_all_launch.sh {n_auvs} {warp}`, e.g. for 5 AUVs at warp 10x: `./generate_all_launch.sh 5 10`
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

For example, `gen/auv.py gobyd` returns the configuration for the `gobyd` application running on the AUV.

Generally you will need to `source preseed.goby` before running any of these Generators manually.

## Environmental variables

These environmental variables are set in the `preseed.goby` file (`goby_launch` runs `source preseed.goby` before launching any applications) or in the systemd service jobs:

- `jaia_log_dir`: Path to directory base for logging. Within this directory, a substructure will be created by the generator scripts:
    - auv/0: Logs for AUV index 0
    - auv/{N}: Logs for AUV index {N}
    - topside: Logs for the topside
- `goby3_lib_dir`: Directory where the libraries for Goby3 are stored. Used to dynamically load protobuf messages from the Goby3 libraries.
- `jaia_lib_dir`: Directory to the libraries for `jaiabot`.
- `LD_LIBRARY_PATH`: Directories to add to the load library path (e.g. used by `dlopen` to dynamically load libraries).
- `jaia_max_number_vehicles`: Maximum number of vehicles to configure communications links for (could be greater than the number actually being run).
- `jaia_n_auvs`: Number of vehicles to actually run
- `jaia_mode`: "simulation" (for simulation) or "runtime" (for in-water/bench testing)
- `jaia_auv_index`: AUV identification number (starting at 0).

## Debugging

By default, all the `.launch` scripts run each application in a GNU `screen` session (detached to start). You can "attach" a terminal window to a screen session with `screen -r`, e.g. `screen -r auv0.gobyd`. To detach and leave the application running, type `CTRL+A D` in the attached terminal window.

### For applications that fail to launch

If you set `-L` for `goby_launch`, it will write a file to `/tmp/goby_launch_screen_*` that will persist after each run. These files show the terminal output for each application, which is useful for debugging failed launches. You can also generate the configuration manually to ensure it is accurate using, for example:

```
source preseed.goby
./gen/auv.py gobyd
```

 You can run any applications on the command line using the same syntax in the .launch file, e.g.

```
source preseed.goby
gobyd <(gen/auv.py gobyd)
```

One useful strategy is to comment-out (#) the application that is having trouble from the .launch file, and then run it with the remaining applications. Once those are running, start the application on the command line manually using the commented-out syntax.


