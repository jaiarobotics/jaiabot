import React from 'react'
import { GlobalContextProvider } from '../../context/GlobalContext'
import { PodContextProvider } from '../../context/PodContext'

import CommandControl from '../client/components/CommandControl'

import './style/app.css'

export default function App() {
  return (
    <div>
      <GlobalContextProvider>
        <PodContextProvider>

          <CommandControl />
          
        </PodContextProvider>
      </GlobalContextProvider> 
    </div>
  )
}
