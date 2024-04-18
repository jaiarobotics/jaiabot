import React from 'react'
import { GlobalContextProvider } from '../../context/GlobalContext'
import { HubContextProvider } from '../../context/HubContext'

import CommandControl from '../client/components/CommandControl'

import './style/app.css'

export default function App() {
  return (
    <div>
      <GlobalContextProvider>
        <HubContextProvider>

          <CommandControl />
          
        </HubContextProvider>
      </GlobalContextProvider> 
    </div>
  )
}
