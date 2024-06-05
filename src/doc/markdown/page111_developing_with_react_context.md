# Developing with React Context
## New Web Directories
## `components`
#### What lives inside this directory?
* Reusable React components
* *Examples:*
    * Toggle
    * Button
    * InputElement

## `containers`
#### What lives inside this directory?
* An element likely to be used only once in the interface that consists of multiple components
* *Examples:*
    * BotDetails
    * SettingsPanel
    * MissionButtonRow

## `context`
#### What lives inside this directory?
* Contexts for the app. These hold state for different parts of the system in a global fashion.
* *Examples:*
    * GlobalContext
    * PodContext
    * HubContext

## `utils`
#### What lives inside this directory?
* Functions that abstract data processing away from React code
* Eventually we will migrate `src/web/shared/Utilities.tsx` functions into this directory

# Context Structure
### `GlobalContext`
* Contains general data pertaining to the view state of the interface
* *Examples:*
    * `selectedPodElement`
    * `showHubDetails`
    * `hubAccordionStates`
#### `PodContext`
* Encapsulates `HubContext` and `BotContext`
* Provides a location to store pod-wide data
##### `HubContext`
* Stores the `PortalHubStatus`
##### `BotContext`
* Coming soon

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
* ContextType
    * Identifies the properties and types that will be stored in the context
    * Think of this as the state interface
```
// Example
interface GlobalContextType {
    clientID: string,
    controllingClientID: string
    selectedPodElement: SelectedPodElement
    ...
}
```
* Action
    * Lays out the properties and types of the action object passed to the reducer function. `type` is the only required property.
    * The optional properties are used to pass data to specific reducer helper functions
```
// Example
interface Action {
    type: string,
    clientID?: string,
    hubAccordionName?: string
}
```
* ContextProviderProps
    * Satisfies TypeScript's requirements for accepting a React Component as a prop
```
// Example
interface GlobalContextProviderProps {
    children: ReactNode
}
```

#### 3. Constant Variables and Enums
#### 4. Context Instantiation
The default values of the context are set to `null` because they are set in the context provider function. This convention is discussed in the React documentation: (https://react.dev/reference/react/createContext).

We use two instances of createContext. The first is responsible for holding state and the second is responisble for triggering state changes. This follows the reccommended structure in the React documentation: (https://react.dev/learn/scaling-up-with-reducer-and-context).
```
export const GlobalContext = createContext(null)
export const GlobalDispatchContext = createContext(null)
```

#### 5. Reducer Function
A reducer function is called by a dispatch function that comes from "using" the dispatch context. The only required property of the `action` object is `type` which is a string describing the type of action to dispatch. In some cases, you will want to pass data to the reducer function to set state to your desired value. If that is the case, modify the `Action` interface, so you can pass that data in with the `action` object.   
```
function globalReducer(state: ContextType, action: Action) {
    let mutableState = {...state}
    switch (action.type) {
        case 'SAVED_CLIENT_ID':
            return saveClientID(mutableState, action.clientID)

        case 'TAKE_CONTROL_SUCCESS':
            return handleControlTaken(mutableState)
            
        case 'CLOSED_HUB_DETAILS':
            return handleClosedHubDetails(mutableState)
        .
        .
        .
}
```
```
    // Example of calling the dispatch function from a different file

    import { GlobalDispatchContext } from '../context/GlobalContext'

    const globalDispatch = useContext(GlobalDispatchContext)

    function handleClosePanel() {
        globalDispatch({ type: 'CLOSED_HUB_DETAILS' })
    }
```

#### 6. Reducer Helper Functions
Prevents the reducer function from becoming bloated with logic. This allows the team to quickly scan the reducer function for the different actions that can be dispatched. These functions return the updated `mutableState` object *(a custom convention)* which is returned by the reducer to update the state tied to the context.
```
function saveClientID(mutableState: GlobalContextType, clientID: string) {
    mutableState.clientID = clientID
    return mutableState
}

function handleControlTaken(mutableState: GlobalContextType) {
    mutableState.controllingClientID = mutableState.clientID
    return mutableState
}
```

#### 7. Context Provider Component
This componet combines the two context instances and sets them into the correct state to be accessed by their child components. Creating this wrapper around the `.Provider` calls reduces the code that is used in the files that import the context, and it also allows us to use `useEffect` to dispatch an action on the intialization of the context (if needed).
```
export function HubContextProvider({ children }: HubContextProviderProps) {
    const [state, dispatch] = useReducer(hubReducer, null)

    return (
        <HubContext.Provider value={state}>
            <HubDispatchContext.Provider value={dispatch}>
                { children }
            </HubDispatchContext.Provider>
        </HubContext.Provider>
    )
}
```

