// React //
import React, { useEffect, useContext } from 'react'
import { GlobalContext, GlobalDispatchContext } from '../context/GlobalContext'
import { HubContext } from '../context/HubContext'
import { HealthStatusLine } from './HealthStatusLine'

// Utils //
import { addDropdownListener, convertMicrosecondsToSeconds, formatLatitude, formatLongitude } from '../shared/Utilities'
import { CommandInfo, hubCommands, sendHubCommand, takeControl } from '../utils/commands'

// Styles //
import Button from '@mui/material/Button'
import Accordion from '@mui/material/Accordion'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import { ThemeProvider, createTheme } from '@mui/material'
import { Icon } from '@mdi/react'
import { mdiPower, mdiRestart, mdiRestartAlert } from '@mdi/js'


export function HubDetails() {
    const globalContext = useContext(GlobalContext)
    const globalDispatch = useContext(GlobalDispatchContext)

    const hubContext = useContext(HubContext)

    if (hubContext === null || !globalContext.showHubDetails) {
        return <div></div>
    }

    const hubStatus = hubContext.hubStatus['0']

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
        globalDispatch({ type: 'CLOSED_HUB_DETAILS' })
    }

    function getStatusAgeClassName(portalStatusAge: number) {
        const healthFailedTimeout = 30
        const healthDegradedTimeout = 10
        const statusAgeSeconds = convertMicrosecondsToSeconds(portalStatusAge)
        
        if (statusAgeSeconds > healthFailedTimeout) {
            return 'healthFailed'
        }

        if (statusAgeSeconds > healthDegradedTimeout) {
            return 'healthDegraded'
        }

        return ''
    }

    function getCPULoadAverage(timeMins: number) {
        const loads = hubContext.hubStatus?.processor?.loads
        
        if (loads === undefined) {
            return 'N/A'
        }

        switch (timeMins) {
            case 1:
                return loads.one_min.toFixed(2)
            case 5:
                return loads.five_min.toFixed(2)
            case 15:
                return loads.fifteen_min.toFixed(2)
            default:
                return 'N/A'
        }
    }

    async function issueHubCommand(command: CommandInfo) {
        const isControlTaken = await takeControl(globalContext.clientID)
        if (isControlTaken) {
            console.log('about to dispatch')
            globalDispatch({
                type: 'TAKE_CONTROL_SUCCESS'
            })
        }
        sendHubCommand(hubStatus.hub_id, command)
    }

    return (
        <div id='hubDetailsBox'>
             <div className='titleBar'>
                 <h2 className='name'>{`Hub ${hubStatus.hub_id}`}</h2>
                 <div className='closeButton' onClick={handleClosePanel}>⨯</div>
             </div>
             <div id='hubDetailsAccordionContainer' className='accordionParentContainer'>
                 <ThemeProvider theme={makeAccordionTheme()}>
                     <Accordion 
                        expanded={globalContext.hubAccordionStates.quickLook} 
                        onChange={() => globalDispatch({ type: 'CLICKED_HUB_ACCORDION', hubAccordionName: 'quickLook' })}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
                        >
                            <Typography>Quick Look</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <table>
                                <tbody>
                                    <HealthStatusLine hubStatus={hubStatus}/>
                                    <tr>
                                        <td>Latitude</td>
                                        <td>{formatLatitude(hubStatus?.location.lat)}</td>
                                    </tr>
                                    <tr>
                                        <td>Longitude</td>
                                        <td>{formatLongitude(hubStatus?.location.lon)}</td>
                                    </tr>
                                    <tr className={getStatusAgeClassName(hubStatus.portalStatusAge)}>
                                        <td>Status Age</td>
                                        <td>{convertMicrosecondsToSeconds(hubStatus.portalStatusAge).toFixed(0)} s</td>
                                    </tr>
                                    <tr>
                                        <td>CPU Load Average (1 min)</td>
                                        <td>{getCPULoadAverage(1)}</td>
                                    </tr>
                                    <tr>
                                        <td>CPU Load Average (5 min)</td>
                                        <td>{getCPULoadAverage(5)}</td>
                                    </tr>
                                    <tr>
                                        <td>CPU Load Average (15 min)</td>
                                        <td>{getCPULoadAverage(15)}</td>
                                    </tr>
                                    <tr>
                                        <td>Wi-Fi Link Quality</td>
                                        <td>{hubStatus?.linux_hardware_status?.wifi?.link_quality_percentage + " %"}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>

                <ThemeProvider theme={makeAccordionTheme()}>
                    <Accordion 
                        expanded={globalContext.hubAccordionStates.commands} 
                        onChange={() => globalDispatch({ type: 'CLICKED_HUB_ACCORDION', hubAccordionName: 'commands' })}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
                        >
                            <Typography>Commands</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Button 
                                className={' button-jcc'} 
                                onClick={() => { issueHubCommand(hubCommands.shutdown) }}>
                                    <Icon path={mdiPower} title='Shutdown'/>
                            </Button>
                            <Button 
                                className={' button-jcc'} 
                                onClick={() => { issueHubCommand(hubCommands.reboot) }}>
                                    <Icon path={mdiRestartAlert} title='Reboot'/>
                            </Button>
                            <Button 
                                className={' button-jcc'}  
                                onClick={() => { issueHubCommand(hubCommands.restartServices) }}>
                                    <Icon path={mdiRestart} title='Restart Services'/>
                            </Button>
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>
            </div>
        </div>
    )
}
