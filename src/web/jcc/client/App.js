// React
import React from 'react'

// Jaia
import { GlobalContextProvider } from '../../context/GlobalContext'
import { PodContextProvider } from '../../context/PodContext'
import CommandControl from '../client/components/CommandControl'

// Style
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
