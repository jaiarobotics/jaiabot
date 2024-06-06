// React -- Jaia
import React, { useContext, useEffect, useState } from 'react'
import { GlobalContext, GlobalDispatchContext } from '../context/GlobalContext'
import { HealthStatusLine } from '../components/HealthStatusLine'
import { GlobalActions } from '../context/actions/GlobalActions'
import { HubContext } from '../context/HubContext'

// Utilities
import { addDropdownListener, convertMicrosecondsToSeconds, formatLatitude, formatLongitude } from '../shared/Utilities'
import { CommandInfo, hubCommands, sendHubCommand, takeControl } from '../utils/commands'

// Styles
import Button from '@mui/material/Button'
import Accordion from '@mui/material/Accordion'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import { ThemeProvider, createTheme } from '@mui/material'
import { Icon } from '@mdi/react'
import { mdiPower, mdiRestart, mdiRestartAlert, mdiChartLine, mdiWifiCog, mdiWrenchCog } from '@mdi/js'

export function HubDetails() {
    const globalContext = useContext(GlobalContext)
    const globalDispatch = useContext(GlobalDispatchContext)

    const hubContext = useContext(HubContext)

    if (hubContext === null || !globalContext.showHubDetails) {
        return <div></div>
    }

    const [accordionTheme, setAccordionTheme] = useState(createTheme({
        transitions: {
            create: () => 'none',
        }
    }))

    useEffect(() => {
        addDropdownListener('accordionContainer', 'hubDetailsAccordionContainer', 30)
    }, [])

    const firstKey = Object.keys(hubContext.hubStatus)[0]
    const hubStatus = hubContext.hubStatus[firstKey]

    /**
     * Dispatches an action to close the HubDetails panel
     * 
     * @returns {void}
     */
    function handleClosePanel() {
        globalDispatch({ type: GlobalActions.CLOSED_HUB_DETAILS })
    }

    /**
     * Provides a class name that corresponds to styles illustrating comms health
     * 
     * @param {number} portalStatusAge Time since last communication between hub and tablet
     * @returns {string} Class name that dictates the style of the status age
     */
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

    /**
     * Provides the hub CPU load average for 1, 5, and 15 min intervals
     * 
     * @param {number} timeMins Time interval dictating which load average to return
     * @returns {number | string} Load average for the hub or 'N/A' if an issue arises
     */
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

    /**
     * Makes sure control is taken, then calls the function to send a command
     * 
     * @param {CommandInfo} command Contains command instructions
     * @returns {void}
     */
    async function issueHubCommand(command: CommandInfo) {
        const isControlTaken = await takeControl(globalContext.clientID)
        if (isControlTaken) {
            globalDispatch({ type: GlobalActions.TAKE_CONTROL_SUCCESS })
        }
        sendHubCommand(hubStatus.hub_id, command)
    }

    /**
     * Opens the JDV in a separate tab
     * 
     * @returns {void}
     */
    function openJDV() {					
        const hubOctal = 10 + hubStatus.hub_id
        const fleetOctal = hubStatus.fleet_id
        const url = `http://10.23.${fleetOctal}.${hubOctal}:40010`
        window.open(url, '_blank')
    }

    /**
     * Opens the router page in a separate tab
     * 
     * @returns {void}
     */
    function openRouterPage() {
        const fleetOctal = hubStatus.fleet_id
        const url = `http://10.23.${fleetOctal}.1`
        window.open(url, '_blank')
    }

    /**
     * Opens the upgrade page in a separate tab
     * 
     * @returns {void}
     */
    function openUpgradePage() {
        const hubOctal = 10 + hubStatus.hub_id
        const fleetOctal = hubStatus.fleet_id 
        const url = `http://10.23.${fleetOctal}.${hubOctal}:9091`
        window.open(url, '_blank')
    }

    return (
        <div id='hubDetailsBox'>
            <div className='titleBar'>
                <h2 className='name'>{`Hub ${hubStatus.hub_id}`}</h2>
                <div className='closeButton' onClick={handleClosePanel}>⨯</div>
            </div>

            <div id='hubDetailsAccordionContainer' className='accordionParentContainer'>
                <ThemeProvider theme={accordionTheme}>
                    <Accordion 
                        expanded={globalContext.hubAccordionStates.quickLook} 
                        onChange={() => globalDispatch({ type: GlobalActions.CLICKED_HUB_ACCORDION, hubAccordionName: 'quickLook' })}
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
                                    <HealthStatusLine healthState={hubStatus?.health_state}/>
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
                                        <td>{convertMicrosecondsToSeconds(hubStatus.portalStatusAge).toFixed(1)} s</td>
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

                <ThemeProvider theme={accordionTheme}>
                    <Accordion 
                        expanded={globalContext.hubAccordionStates.commands} 
                        onChange={() => globalDispatch({ type: GlobalActions.CLICKED_HUB_ACCORDION, hubAccordionName: 'commands' })}
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
                
                <ThemeProvider theme={accordionTheme}>
                    <Accordion 
                        expanded={globalContext.hubAccordionStates.links} 
                        onChange={() => globalDispatch({ type: GlobalActions.CLICKED_HUB_ACCORDION, hubAccordionName: 'links' })}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
                        >
                             <Typography>Links</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Button
                                className={'button-jcc'} 
                                onClick={() => openJDV()}
                            >
                                <Icon path={mdiChartLine} title='JDV'/>
                            </Button>
                            
                            <Button className="button-jcc" onClick={() => openRouterPage()}>
                                <Icon path={mdiWifiCog} title="Router"></Icon>
                            </Button>
                        
                            <Button className="button-jcc" onClick={() => openUpgradePage()}>
                                <Icon path={mdiWrenchCog} title="Upgrade"></Icon>
                            </Button>

                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>

            </div>
        </div>
    )
}
