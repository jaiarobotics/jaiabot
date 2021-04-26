# Jaiabot Repositories

The source code for the Jaiabot is split between two Git repositories:

- `jaiabot-hydro`: Source code (C++ primarily) that is built into compiled code (binaries and libraries).
- `jaiabot-configuration`: Runtime configuration using Python as a preprocessor that is used as inputs to the compiled code.

## jaiabot-hydro

This Git repository is hosted at <https://github.com/jaiarobotics/jaiabot-hydro>.

It consists of source code that is compiled into a variety of binary applications and libraries to be run on the target platforms (vehicles and base station computers). This compilation can carried out manually by the developers on their computers and automatically be the CircleCI service for the target hardware. See [Building and CI/CD](page20_build.md) for more details.

The filesystem structure of this repository is as follows:

- `build`: Output used by CMake for binaries and other generated objects when using the `build.sh` script.
- `.circleci`: Configuration for CircleCI
    - `config.yml`: [CircleCI workflow configuration](https://circleci.com/docs/2.0/configuration-reference/)
- `cmake`: Folder for additional CMake helper code.
- `.git`: Git repository files (should not be directly edited)
- `scripts`: Various helper shell scripts
    - `update_copyright.sh`: Run to prepend copyright message to new and existing source code files in the entire jaiabot-hydro project based on latest Git author information and the templates in `src/doc/copyright`.
    - `clang-format-hooks`: Git hook (scripts) for running `clang-format` on the edited files in each commit, which enforces a uniform code style across the entire repository.
- `src`: Source code
    - `lib`: Source code for the libraries
        - `messages`: Protobuf message definitions
    - `bin`: Source code for the binaries
        - `patterns`: Example "template" applications for use when generating new applications, if desired.
    - `doc`: Source code for the documentation.
        - `copyright`: Copyright header text for use by the `update_copyright.sh` script to prepend to each source code file.
        - `doxygen`: Configuration for the doxygen configuration generation tool.
        - `figures`: Figures and images for use in the Markdown documentation.
        - `markdown`: Markdown documentation files.
- `build.sh`: Convenience script for invoking CMake in the `build` directory.
- `.clang-format`: `clang-format` automatic formatting instructions. Run `./git-pre-commit-format install` from within `scripts/clang-format-hooks` once after cloning this project to enforce `clang-format` on each Git commit.
- `CMakeLists.txt`: Root level CMake instructions.
- `COPYING`: Copyright information.
- `.gitignore`: Files to have Git ignore.
- `README.md`: Root level documentation shown by Github.

## jaiabot-configuration

*Work in progress*
