// React
import React, { useEffect, useContext } from 'react'
import { GlobalContext, GlobalDispatchContext } from '../../../context/GlobalContext'
import { PodContext, PodDispatchContext } from '../../../context/PodContext'


import { addDropdownListener } from './shared/Utilities'

import { ThemeProvider, createTheme } from '@mui/material';
import { CatchingPokemonSharp } from '@mui/icons-material';


export function HubDetailsComponent() {
    const globalContext = useContext(GlobalContext)
    const globalDispatch = useContext(GlobalDispatchContext)

    const podContext = useContext(PodContext)
    const podDispatch = useContext(PodDispatchContext)

    useEffect(() => {
        addDropdownListener('accordionContainer', 'hubDetailsAccordionContainer', 30)
        podDispatch({ type: 'polled' })
    }, [])

    console.log(podContext)

    const makeAccordionTheme = () => {
        return createTheme({
            transitions: {
                create: () => 'none',
            }
        })
    }

    function handleClosePanel() {
        globalDispatch({ type: 'closedHubDetails' })
    }

    if (!globalContext.showHubDetails) {
        return <div></div>
    }
    return (
        <div id="test-hub-details" onClick={handleClosePanel}></div>
    )
}
