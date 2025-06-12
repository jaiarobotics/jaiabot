# Introduction

JCC is being refactored to use a common Data Model to store our core data and to use React Conext to share it and to use a React Reducer to trigger changes to it. This provides a consistent set of data without having to pass it and callback functions all through Props, which makes the code difficult to understand and modify.

# Data Model

## Bots and Hubs

### bot.ts

Class `Bot` provides setters and getters that access private scalar and array variables. The `Bot` class includes `TaskPacket` and `BotSensors` defined in `task-packets.ts` and `bot-sensors.ts`.

The Bot class is the only thing exported.

### bots.ts

Class `Bots` provides setters and getters that access data in a private Map of Bot class objects

A singleton object of the class is provided for clients to access bot data.

The singleton includes a public accessor `getBots` function that provides a reference of the private `bots` Map.

**NOTES:** bots creates a new Map whenever a bot is added, therefore client software should call `getBots()` each processing cycle and not rely on local copies of the bots reference. For this reason all React Components should access the data by using JaiaContext, which will be updated as needed for each rendering. Although references to individual bots will not change when the Map is recreated it is always a good idea to use getBot() when accessing bot data.

### hub.ts & hubs.ts

Identical structure to `bot.ts` and `bots.ts`. All the same notes apply.

## Missions

### mission.ts

Class `Mission` provides setters and getters to private scalar and array variables. The `Mission` class includes an array of `Waypoint` defined in `waypoints.ts`.

### missions.ts

Class Missions provides setters and getters that access a private Map of Mision class objects.
A singleton of the class is provided for clients to access mission data.

missions returned by `getMissions()` are references to the priviate data.

**NOTES:** Unlike bots and hubs, missions are not sorted when new ones are added, therefore a new map is only created when the singleton is constructed. This is because the missionID of the new mission is set by `addMission()`, overwriting whatever ID was passed in the `mission` parameter. Because the Map is never replaced there is no need to call `getMissions()` when a mission is added.

**TODO:** If we leave this module the way it is now, we should eliminate the calls to `missions.getMissions()` where not needed. For example in `JaiaContext.tsx` `handleAddMission` & `handleDeleteMission`

## Jaia Global

In addition to the bots, hubs and missions our data model includes other state related data that needs to be shared with `OpenLayers` This data is used to save the state of the JCC application.

### jaia-global.ts

jaia-global contains the Selected Node, Selected Waypoint and the current Default Task Parameters. Additional data related to the state of the application may be added.

## General comments

All of our data stores are using Maps to store objects of the various classes. These classes all include an ID as part of the object data. These IDs are also used as indexes into the Maps they are stored in, however there is no gaurantee they will match or that the one in the object is even defined. This creates a confusing pattern where you need to manually set the ID of the object either before or after adding it. If we used arrays, we would not need to redundantly store the ID. We could still search for array elements of a given ID. Considering how small these arrays are the search would be quick.

# Context

While the Data Model described above is our primary source of data it can all be accessed and updated using copies of the references stored as React Context and React Reducers. React components should use the data in the Context so they get re-rendered when the Context changes. However some modules, particularly things related to OpenLayers are not React components and need to access the data store directly.

## JaiaContext.tsx

`JaiaContext.tsx` provides the Context and Reducers and all supporting types and interfaces.

### JaiaContextType

This defines all the data comprsing the global context for the JCC React application. It includes all of the data in the Data Model described above as well as data controling the state of various React Components. (Application State data needed by OpenLayers is included in jaia-global, see above)

**NOTES** For bots, hubs and missions the Context data items are direct references to the Data Model obtained through `bots.getBots()`, `hubs.getHubs()`, & `missions.getMissions()`. This means that one must be mindful of how to use these references are updated (see above).

## Using Context in React

All of our React components should access the Data Model via the Context and use the Reducers to modify it.

```
    const jaiaContext: JaiaContextType = useContext(JaiaContext);
    const jaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);
```

React components should never call the getters directly in the Data Model they should always go through `JaiaContext`
As long as the data is handled correctly in `JaiaContext.tsx` the React Components will always have the latest data in the Data Model. React will re-render a componenet if it is displaying data from `JaiaContext` whenever the data changes.
