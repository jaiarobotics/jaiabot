# JaiaBot Software

This repository houses the source code for the JaiaBot micro-UUV. 

Please see the documentation: [compiled by Doxygen](https://docs.jaia.tech/) or in [Markdown](https://github.com/jaiarobotics/jaiabot/blob/1.y/src/doc/markdown/page01_main.md).

## Building

Run the build.sh script to build the software.  This will start a parallel build using a number of processors that is equal to the lesser of:

* The total number of available processors
* The total physical memory divided by 2 GB, (the typical maximum RAM consumption per process)

You can manually define the number of CPUs to use by setting the `JAIA_BUILD_NPROC` environment variable.

Additional parameters can be passed to `cmake` and `make` using the following environment variables:

* `JAIABOT_CMAKE_FLAGS`
* `JAIABOT_MAKE_FLAGS`
