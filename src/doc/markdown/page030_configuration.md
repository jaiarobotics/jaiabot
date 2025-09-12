# Configuration

The jaiabot configuration files can be found in the `jaiabot/config` folder of the repository.

At it's simplest, you can simulate any 4 vehicles at 5x real speed by running:

```
./generate_all_launch.sh 4 5
./all.launch
```

And type CTRL+C in that terminal to cleanly shutdown after you're done.

## Overview

The configuration folder is more than simply flat configuration files. Rather, it is a configuration generation tool box that allows for:

* Easy switching from simulation to in-water ("runtime") configuration with minimal changes and maximum overlap of configuration.
* Reuse of configuration file components for different vehicle ids and eventually types.
* Reuse of common configuration between bot and hub shared code.

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
