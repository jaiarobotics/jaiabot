import React, { useEffect, useContext } from 'react'
import { GlobalContext, GlobalDispatchContext } from '../context/GlobalContext'

import { addDropdownListener } from '../jcc/client/components/shared/Utilities'

import { ThemeProvider, createTheme } from '@mui/material'

export function HubDetailsComponent() {
    const globalContext = useContext(GlobalContext)
    const globalDispatch = useContext(GlobalDispatchContext)

    useEffect(() => {
        addDropdownListener('accordionContainer', 'hubDetailsAccordionContainer', 30)
    }, [])

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
