# Architecture

Preliminary Jaiabot system block diagram:

![Architecture](../figures/jaiabot-software.png)

## Middlewares

`jaiabot-hydro` is based primarily on two publish/subscribe asynchronous middlewares:

- Goby3: <https://goby.software/3.0/>
- MOOS-IvP: <http://moos-ivp.org>

Goby3 forms the core of the communications design, providing interthread, interprocess, and intervehicle communications. MOOS-IvP provides the behavior-based autonomy implementation using the `pHelmIvP` multi-objective decision engine.

In addition, we expect to support clients using `ROS` in the future.