import React, { useReducer } from 'react'
import { GlobalContext, GlobalDispatchContext, globalDefaultContext } from '../../context/GlobalContext'
import { PodContext, PodDispatchContext, podDefaultContext } from '../../context/PodContext'
import CommandControl from '../client/components/CommandControl'

import { jaiaAPI } from '../../jcc/common/JaiaAPI'

import './style/app.css'

export default function App() {
  const [globalState, globalDispatch] = useReducer(globalStateReducer, globalDefaultContext)
  const [podState, podDispatch] = useReducer(podStateReducer, podDefaultContext)

  return (
    <div>
      <GlobalContext.Provider value={globalState}>
        <GlobalDispatchContext.Provider value={globalDispatch}>
            
            <PodContext.Provider value={podState}>
              <PodDispatchContext.Provider value={podDispatch}>
              
                <CommandControl />

              </PodDispatchContext.Provider>
            </PodContext.Provider>

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

function podStateReducer(currentState, action) {
  switch (action.type) {
    case 'polled': {
      return jaiaAPI.getStatus().then((result) => {
        return result
      })
    }
  }
}
