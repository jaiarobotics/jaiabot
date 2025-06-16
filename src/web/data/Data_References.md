-   [Introduction](#introduction)
-   [Data Model](#data-model)
    -   [Bots and Hubs](#bots-and-hubs)
        -   [bot.ts](#botts)
        -   [bots.ts](#botsts)
        -   [hub.ts \& hubs.ts](#hubts--hubsts)
    -   [Missions](#missions)
        -   [mission.ts](#missionts)
        -   [missions.ts](#missionsts)
        -   [missions-manager.ts](#missions-managerts)
    -   [Supporting Data Structures](#supporting-data-structures)
        -   [Sensors](#sensors)
        -   [waypoint.ts](#waypointts)
        -   [task.ts](#taskts)
        -   [task-packets-new.ts](#task-packets-newts)
    -   [Jaia Global](#jaia-global)
        -   [jaia-global.ts](#jaia-globalts)
-   [Context](#context)
    -   [JaiaContext.tsx](#jaiacontexttsx)
        -   [JaiaContextType](#jaiacontexttype)
    -   [Using Context in React](#using-context-in-react)

# Introduction

JCC is being refactored to use a common Data Model to store our core data and to use React Conext to share it and to use a React Reducer to trigger changes to it. This provides a consistent set of data without having to pass data and callback functions through Props. This will yield a code base that is easier to understand, less coupled and simpler to maintain.

# Data Model

We refer to the common data store in the JCC application as the Data Model.

## Bots and Hubs

### bot.ts

Class `Bot` provides setters and getters that access private scalar and array variables. The `Bot` class includes `TaskPacket` and `BotSensors` defined in `task-packets.ts` and `bot-sensors.ts`.

The Bot class is the only thing exported.

### bots.ts

Class `Bots` provides setters and getters that access data in a private Map of Bot class objects

A singleton object of the class is provided for clients to access bot data.

The singleton includes a public accessor `getBots` function that provides a reference of the private `bots` Map.

**NOTES:** bots creates a new Map whenever a bot is added, therefore client software should call `getBots()` each processing cycle and not rely on local copies of the `bots` reference. For this reason all React Components should access the data by using `JaiaContext`, which will be updated as needed for each rendering. Although references to individual bots will not change when the Map is recreated it is always a good idea to use getBot() when accessing bot data.

### hub.ts & hubs.ts

Identical structure to `bot.ts` and `bots.ts`. All the same notes apply.

## Missions

### mission.ts

Class `Mission` provides setters and getters to private scalar and array variables. The `Mission` class includes an array of `Waypoint` defined in `waypoints.ts`.

### missions.ts

Class `Missions` provides setters and getters that access data in a private Map of `Mision` class objects.
A singleton of the class is provided for clients to access mission data.

missions returned by `getMissions()` are references to the priviate data.

**NOTES:** Unlike bots and hubs, missions are not sorted when new ones are added, therefore a new map is only created when the singleton is constructed.

### missions-manager.ts

Class `MissionsManager` provides bi-directional mapping between bots and missions and functions to manage these assignments.

## Supporting Data Structures

### Sensors

The `sensors` directory contains files that define the various sensors used by bots and hubs described above. Current sensor suite inicludes `conductivity.ts`,`gps.ts`,`imu.ts`, `pressure.ts`, `temperature.ts`. All of these files provide a class for the sensor type and the appropriate setters and getters to update the data associated with them.

### waypoint.ts

Class `Waypoint` provides setters and getters to create and manage waypoints. Waypoints are the building blocks of missions.

### task.ts

Class `Task` provides seetters and getters for the parameters of all the different task types. Tasks are assigned to each waypoint.

### task-packets-new.ts

Class `TaskPacket` provdies setters and getters of different types of task packets. Task Packets are the result of performing tasks at waypoints while executing a mission. The `TaskPacket`s are stored as part of the `bot` data. Each `bot` holds an array of `TaskPacket`s

## Jaia Global

In addition to the bots, hubs and missions our data model includes other state related data that needs to be shared with `OpenLayers` This data is used to save the state of the JCC application.

### jaia-global.ts

jaia-global contains the Selected Node, Selected Waypoint and the current Default Task Parameters. Additional data related to the state of the application may be added.

# Context

While the Data Model described above is our primary source of data it can all be accessed and updated using copies of the references stored as React Context and React Reducers. **React components should use the data in the Context so they get re-rendered when the Context changes**. However some modules, particularly things related to OpenLayers are not React components and need to access the data store directly.

## JaiaContext.tsx

`JaiaContext.tsx` provides the React Context and Reducers and all supporting types and interfaces.

### JaiaContextType

This defines all the data comprsing the global context for the JCC React application. It includes all of the data in the Data Model described above as well as data controling the state of various React Components. (Application State data needed by OpenLayers is included in jaia-global, see above)

**NOTES** For bots, hubs and missions the Context data items are direct references to the Data Model obtained through `bots.getBots()`, `hubs.getHubs()`, & `missions.getMissions()`. This means that one must be mindful of how to use these references and consider when and if they are updated (see above).

## Using Context in React

All of our React components should access the Data Model via the Context and use the Reducers to modify it.

```
    const jaiaContext: JaiaContextType = useContext(JaiaContext);
    const jaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);
```

React components should never call the getters directly in the Data Model they should always go through `JaiaContext`
As long as the data is handled correctly in `JaiaContext.tsx` the React Components will always have the latest data in the Data Model. React will re-render a componenet if it is displaying data from `JaiaContext` whenever the data changes.
