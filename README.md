# Jaia Robotics Software

This repository contains the core software stack for the JaiaBot, a modular aquatic drone developed by Jaia Robotics. JaiaBots are designed for scalable, autonomous ocean sensing missions that can be deployed in fleets for depth mapping, environmental monitoring, and rapid data collection.

Please visit our website to learn more: [Jaia Robotics](https://www.jaia.tech)

## Overview

### Autonomy & Navigation
- Built on [MOOS-IvP](https://oceanai.mit.edu/moos-ivp/), combining proven autonomy behaviors with Jaia Robotics' custom state machine logic.
  - **MOOS-IvP Behaviors**
    - Waypoint Behavior
    - StationKeep Behavior
    - Constant Heading Behavior
    - Constant Speed Behavior
    - Trail Behavior
  - **Jaia Robotics Extensions**
    - Boost Statechart for mission state management
    - Dive Behavior for depth-controlled operation
    - Surface Drift Behavior for passive surface sampling
    - Safety Behaviors for fail-safe recovery and mission protection
### Communication
- Built on the [Goby3 middleware](https://github.com/GobySoft/goby3) and [DCCL](https://github.com/GobySoft/dccl) encoding framework, providing efficient message transport and interprocess communication across distributed systems.  
- Currently supports point-to-point networking over **XBee**, **Wi-Fi**, and **Iridium**, with a **cloud interface** for remote fleet coordination and command.
### Control & Visualization
- Through the Jaia Command & Control (JCC) and Jaia Data Vision (JDV) apps for real-time fleet monitoring and mission replay.

## Documentation

- Full API and build documentation: [docs.jaia.tech](https://docs.jaia.tech/)
- Release notes and changelog: [GitHub Releases](https://github.com/jaiarobotics/jaiabot/releases)

## Tech Stack

| Component     |  **3.y**            |
|---------------|-----------------------------|
| **Ubuntu**    | **26.04 (resolute)**        |
| **Python**    | **3.14**          |
| **C++**       | **C++23**                   |
| **MOOS-IvP**  | **24.8**                    |
| **Goby**      | **3.2**                     |
| **Wt**        | **4.11**                    |
| **Node.js**   | **24.14**                   |
| **Languages**   | **C++, Python, TypeScript, Shell**                   |

The authoritative Ubuntu, Node.js and toolchain versions for this branch are defined in [`scripts/common-versions.env`](scripts/common-versions.env).
