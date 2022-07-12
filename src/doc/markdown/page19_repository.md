# JaiaBot Repositories

The source code for the JaiaBot is split between two Git repositories:

- `jaiabot`: Source code (C++ primarily) that is built into compiled code (binaries and libraries).
- `jaiabot-rootfs-gen`: Root filesystem generation for jaiabot
- `jaiabot-debian`: Debian packaging files for jaiabot

## jaiabot

This Git repository is hosted at <https://github.com/jaiarobotics/jaiabot>.

It consists of source code that is compiled into a variety of binary applications and libraries to be run on the target platforms (vehicles and base station computers). This compilation can be carried out manually by the developers on their computers and automatically be the CircleCI service for the target hardware. See [Building and CI/CD](page20_build.md) for more details.

The filesystem structure of this repository is as follows:

- `.circleci`: Configuration for CircleCI
    - `config.yml`: [CircleCI workflow configuration](https://circleci.com/docs/2.0/configuration-reference/)
- `.docker`: Docker containers for the CircleCI build
- `.git`: Git repository files (should not be directly edited)
- `.vagrant`: 
- `build`: Output used by CMake for binaries and other generated objects when using the `build.sh` script. (Doesn't exist until you run `build.sh`)
- `cmake`: Folder for additional CMake helper code.
- `config`: configuration files for how the system runs
    - `gen`: the scripts themselves
    - `launch`: a way to launch the jaiabot apps semi-manually (as opposed to systemd)
    - `templates`: inputs to the gen scripts
    - `preseed.goby`: source this before launching to set environment variables
- `scripts`: Various helper shell and python scripts.
    - `75-jaiabot-status`: login message for ssh.
    - `arm64-build.sh`: run from within the docker container to build the code base.
    - `calibration`: Used to set the operating limits of the linear actuators and motor when the vehicle is built.
    - `clang-format-hooks`: Git hook (scripts) for running `clang-format` on the edited files in each commit, which enforces a uniform code style across the entire repository.
    - `docker-arm64-build-and-deploy.sh`: Run this to build an arm64 version of the code and send it over ssh to target platforms.
    - `docker-build-build-system.sh`: Run this to build your local docker container for building. Also run it to update the container with new apt package versions.
    - `docker-create-push-for-circleci.sh`: 
    - `docker-login-to-build-system.sh`: Log into the container to make manual changes or inspect the build.
    - `git-archive-all.sh`: Used to build a tarfile of the repository and its submodules. Currently no submodules are being used.
    - `gps-i2c`: A set of files and tools used to communicate to our i2c gps device.
    - `grab-journalctl.sh`: Use this to grab recent journalctl files for jaiabot processes. Useful for debugging.
    - `jaiabot-checkloadavg.py`: Waits for the load average is below a certain threshold. Used to delay MOOS processes from starting right away.
    - `kill-jaiabot-processes.sh`: Run this to kill all processes related to a running jaiabot instance. Sometimes useful when troubleshooting.
    - `log-analysis`: A set of tools to get the logs from the platforms, store them on a server, retrieve them, convert them, and view them graphically in a browser.
    - `motor-testing`: Various scripts we're using to test some motor functionality - not intended to be in the release.
    - `reset-xbee-modem.py`: Run this to make sure the radio is in transparent mode.
    - `setup-tools-build.sh`: Run this to install various packages you will need to build the code base.
    - `setup-tools-runtime.sh`: Run this to install various packages you will need to run the code locally.
    - `update_copyright.sh`: Run to prepend copyright message to new and existing source code files in the entire jaiabot project based on latest Git author information and the templates in `src/doc/copyright`.
- `src`: Source code.
    - `arduino`: Arduino source code and some scripts to upload them.
    - `bin`: Source code for the binaries.
        - `patterns`: Example "template" applications for use when generating new applications, if desired.
    - `doc`: Source code for the documentation.
        - `copyright`: Copyright header text for use by the `update-copyright.sh` script to prepend to each source code file.
        - `doxygen`: Configuration for the doxygen configuration generation tool.
        - `figures`: Figures and images for use in the Markdown documentation.
        - `markdown`: Markdown documentation files.
    - `lib`: Source code for the libraries.
        - `messages`: Protobuf message definitions.
    - `python`: Python scripts (mostly readily available drivers).
    - `web`: The web interface for the JaiaBot system.
        - `central_command`: The main user interface.
        - `engineering`: A panel for engineers to interact directly with a JaiaBot for testing and diagnostics.
        - `server`: A Flask server (app.py) hosting our REST API.
        - `run.sh`: This will build and run `central_command`, `engineering`, and `server`.
- `.clang-format`: `clang-format` automatic formatting instructions. Run `./git-pre-commit-format install` from within `scripts/clang-format-hooks` once after cloning this project to enforce `clang-format` on each Git commit.
- `.gitignore`: Files to have Git ignore.
- `.gitmodules`: Was used for a python virtual environment, but will likely go away.
- `CMakeLists.txt`: Root level CMake instructions.
- `COPYING`: Copyright information.
- `README.md`: Root level documentation shown by Github.
- `build.sh`: Convenience script for invoking CMake in the `jaiabot/build` directory.


## jaiabot-rootfs-gen
This git repository is hosted at <https://github.com/jaiarobotics/jaiabot-rootfs-gen>.

The filesystem structure of this repository is as follows:

- `auto`:
- `customization`:
- `notes`:
- `scripts`:
- `.gitignore`: Files to have Git ignore.
- `README.md`: Root level documentation shown by Github.

## jaiabot-debian
This git repository is hosted at <https://github.com/jaiarobotics/jaiabot-debian>.

The filesystem structure of this repository is as follows:

- `source`:

*Work in progress*
