import React, { useReducer } from 'react'
import { GlobalContext, GlobalDispatchContext, globalDefaultContext } from '../../context/GlobalContext'
import { HubContextProvider } from '../../context/HubContext'

import CommandControl from '../client/components/CommandControl'

import './style/app.css'

export default function App() {
  const [globalState, globalDispatch] = useReducer(globalStateReducer, globalDefaultContext)

  return (
    <div>
      <GlobalContext.Provider value={globalState}>
        <GlobalDispatchContext.Provider value={globalDispatch}>
          
          <HubContextProvider>
            <CommandControl />
          </HubContextProvider>

        </GlobalDispatchContext.Provider>
      </GlobalContext.Provider>
    </div>
  )
}

function globalStateReducer(currentState, action) {
  switch (action.type) {
    case 'closedHubDetails': {
      const updatedState = {...currentState}
      updatedState.showHubDetails = true
      return updatedState
    }
    default: {
      throw Error('Unknown action: ' + action.type);
    }
  }
}
