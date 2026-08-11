# Developing with React Context

## Web Directories

## components

#### What lives inside this directory?

- React components used to build the JCC interface, from small reusable widgets to full panels. Each component lives in its own directory alongside its `.less` styles and (where present) a `__tests__` directory.
- _Examples:_
  - `JaiaToggle`
  - `__buttons__/StartMissionButton`
  - `BotDetails`
  - `SettingsPanel`
  - `MissionsPanel`

## context

#### What lives inside this directory?

- The React context for the app, which holds state for the whole interface in a global fashion.
- _Contents:_
  - `JaiaContext.tsx` — context instantiation, reducer, and provider
  - `jaia-actions.ts` — the `JaiaActions` enum of all dispatchable action types
  - `action-configs.ts` — maps each `JaiaActions` value to its handler function
  - `handlers/` — the reducer helper functions, grouped by concern (e.g. `mission-handlers.ts`, `panel-handlers.ts`)

## data

#### What lives inside this directory?

- The data model: singleton objects that own the application data and communicate with the server, independent of React.
- _Examples:_
  - `bots`
  - `hubs`
  - `mission_set`
  - `task_packets`

## types

#### What lives inside this directory?

- Shared TypeScript interfaces and enums.
- _Examples:_
  - `context-types.ts` (`JaiaContextType`, `JaiaAction`)
  - `jaia-system-types.ts`

## utils

#### What lives inside this directory?

- Functions that abstract data processing away from React code
- Eventually we will migrate `src/web/shared/Utilities.tsx` functions into this directory

# Context Structure

### JaiaContext

`JaiaContext` is the single context for the JCC interface. It holds:

- References to the data model singletons (`bots`, `hubs`, `taskPackets`, `missionSet`, `rallyPoints`, `missionsManager`, `exclusionZoneSet`, ...)
- View state for the interface (`visibleDetails`, `visiblePanel`, `hubAccordionStates`, `botAccordionStates`, `mapLayerAccordionStates`, ...)

The full shape is defined by the `JaiaContextType` interface in `src/web/types/context-types.ts`.

## General Context Structure

1. Imports
2. Interfaces
3. Constant Variables and Enums
4. Context Instantiation
5. Reducer Function
6. Reducer Helper Functions
7. ContextProvider Component

#### 1. Imports

#### 2. Interfaces

##### Required Interfaces

- ContextType
  - Identifies the properties and types that will be stored in the context
  - Think of this as the state interface

```
// Example (src/web/types/context-types.ts)
export interface JaiaContextType {
    bots: Bots;
    hubs: Hubs;
    taskPackets: TaskPackets;
    visibleDetails: NodeTypes;
    visiblePanel: ButtonNames;
    ...
}
```

- Action
  - Lays out the properties and types of the action object passed to the reducer function. `type` is the only required property.
  - The optional properties are used to pass data to specific reducer helper functions

```
// Example (src/web/types/context-types.ts)
export interface JaiaAction {
    type: JaiaActions;
    botID?: number;
    missionID?: number;
    hubAccordionName?: HubAccordionNames;
    ...
}
```

- ContextProviderProps
  - Satisfies TypeScript's requirements for accepting a React Component as a prop

```
// Example
interface JaiaContextProviderProps {
    children: ReactNode
}
```

#### 3. Constant Variables and Enums

The dispatchable action types are declared as the `JaiaActions` enum in `src/web/context/jaia-actions.ts`. Using an enum (rather than bare strings) means TypeScript catches typos in both the dispatch sites and the handler map.

#### 4. Context Instantiation

The default values of the context are set to `null` because they are set in the context provider function. This convention is discussed in the React documentation: (https://react.dev/reference/react/createContext).

We use two instances of createContext. The first is responsible for holding state and the second is responsible for triggering state changes. This follows the recommended structure in the React documentation: (https://react.dev/learn/scaling-up-with-reducer-and-context).

```
export const JaiaContext = createContext<JaiaContextType>(null)
export const JaiaDispatchContext = createContext(null)
```

#### 5. Reducer Function

A reducer function is called by a dispatch function that comes from "using" the dispatch context. The only required property of the `action` object is `type`, a `JaiaActions` value describing the action to dispatch. In some cases, you will want to pass data to the handler function to set state to your desired value. If that is the case, add the property to the `JaiaAction` interface, so you can pass that data in with the `action` object.

Rather than a large `switch` statement, `jaiaReducer` looks the action up in the `actionConfigs` map (`src/web/context/action-configs.ts`), which associates each action type with its handler function and a `tracked` flag indicating whether the resulting state should be pushed onto the undo/redo history.

```
// src/web/context/JaiaContext.tsx
function jaiaReducer(state: JaiaContextType, action: JaiaAction) {
    const config = actionConfigs.get(action.type);
    if (!config) {
        console.warn(`No handler for action type: ${action.type}`);
        return state;
    }

    let mutableState = { ...state };
    mutableState = config.handler(mutableState, action);

    if (config.tracked) {
        saveHistory(mutableState, action.type);
    }

    return mutableState;
}
```

```
// src/web/context/action-configs.ts
export const actionConfigs: Map<JaiaActions, ActionConfig> = new Map([
    [JaiaActions.ADD_MISSION, { handler: handleAddMission, tracked: true }],
    [JaiaActions.CLOSED_DETAILS, { handler: handleClosedDetails, tracked: false }],
    ...
]);
```

```
    // Example of calling the dispatch function from a different file

    import { JaiaDispatchContext } from '../../context/JaiaContext'
    import { JaiaActions } from '../../context/jaia-actions'

    const jaiaDispatch = useContext(JaiaDispatchContext)

    function handleClosePanel() {
        jaiaDispatch({ type: JaiaActions.CLOSED_DETAILS })
    }
```

#### 6. Reducer Helper Functions

Prevents the reducer function from becoming bloated with logic. This allows the team to quickly scan `action-configs.ts` for the different actions that can be dispatched. These functions live in `src/web/context/handlers` and return the updated `mutableState` object _(a custom convention)_ which is returned by the reducer to update the state tied to the context.

```
// src/web/context/handlers/panel-handlers.ts
export function handleClosedDetails(mutableState: JaiaContextType) {
    mutableState.visibleDetails = NodeTypes.NONE;
    return mutableState;
}
```

#### 7. Context Provider Component

This component combines the two context instances and sets them into the correct state to be accessed by their child components. Creating this wrapper around the `.Provider` calls reduces the code that is used in the files that import the context, and it also allows us to use `useEffect` to dispatch an action on the initialization of the context (if needed).

```
export function JaiaContextProvider({ children }: JaiaContextProviderProps) {
    const [state, dispatch] = useReducer(jaiaReducer, null)

    return (
        <JaiaContext.Provider value={state}>
            <JaiaDispatchContext.Provider value={dispatch}>
                { children }
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>
    )
}
```
