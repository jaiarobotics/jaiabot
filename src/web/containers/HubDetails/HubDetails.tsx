// React -- Jaia
import { useContext, useEffect, useState } from "react";
import { JaiaActions } from "../../context/Jaia/jaia-actions";
import { JaiaContext, JaiaDispatchContext, JaiaAction } from "../../context/Jaia/JaiaContext";
import { HealthStatusLine } from "../../components/HealthStatusLine/HealthStatusLine";

// Utilities
import {
    addDropdownListener,
    convertMicrosecondsToSeconds,
    formatLatitude,
    formatLongitude,
} from "../../shared/Utilities";
import { DEFAULT_HUB_ID } from "../../utils/constants";
import { getIPPrefix } from "../../shared/IPPrefix";
import { NodeTypes } from "../../types/jaia-system-types";
import { HubAccordionNames } from "../../types/context-types";

// Styles
import Button from "@mui/material/Button";
import Accordion from "@mui/material/Accordion";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import { ThemeProvider, createTheme } from "@mui/material";
import { Icon } from "@mdi/react";
import {
    mdiPower,
    mdiRestart,
    mdiRestartAlert,
    mdiChartLine,
    mdiWifiCog,
    mdiWrenchCog,
} from "@mdi/js";

import "./HubDetails.less";

export default function HubDetails() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);

    const IPPrefix = getIPPrefix(location.hostname);

    const [accordionTheme, setAccordionTheme] = useState(
        createTheme({
            transitions: {
                create: () => "none",
            },
        }),
    );

    useEffect(() => {
        addDropdownListener("accordionContainer", "hubDetailsAccordionContainer", 30);
    }, []);

    const hub = jaiaContext.hubs.get(DEFAULT_HUB_ID);

    if (!hub) {
        return <div></div>;
    }

    /**
     * Dispatches an action to close the Hub details panel
     *
     * @returns {void}
     */
    function handleClosePanel() {
        jaiaDispatch({ type: JaiaActions.CLOSED_DETAILS });
    }

    /**
     * Dispatches an action to toggle accordion states
     *
     * @returns {void}
     */
    function handleAccordionClick(accordionName: HubAccordionNames) {
        jaiaDispatch({
            type: JaiaActions.CLICKED_HUB_ACCORDION,
            hubAccordionName: accordionName,
        });
    }

    /**
     * Provides a class name that corresponds to styles illustrating comms health
     *
     * @param {number} portalStatusAge Time since last communication between hub and tablet
     * @returns {string} Class name that dictates the style of the status age
     */
    function getStatusAgeClassName(portalStatusAge: number) {
        const healthFailedTimeout = 30;
        const healthDegradedTimeout = 10;
        const statusAgeSeconds = convertMicrosecondsToSeconds(portalStatusAge);

        if (statusAgeSeconds > healthFailedTimeout) {
            return "healthFailed";
        }

        if (statusAgeSeconds > healthDegradedTimeout) {
            return "healthDegraded";
        }

        return "";
    }

    /**
     * Provides the hub CPU load average for 1, 5, and 15 min intervals
     *
     * @param {number} timeMins Time interval dictating which load average to return
     * @returns {number | string} Load average for the hub or 'N/A' if an issue arises
     */
    function getCPULoadAverage(timeMins: number) {
        const loads = hub.getLinuxHardwareStatus()?.processor?.loads;

        if (!loads) {
            return "N/A";
        }

        switch (timeMins) {
            case 1:
                return loads.one_min.toFixed(2);
            case 5:
                return loads.five_min.toFixed(2);
            case 15:
                return loads.fifteen_min.toFixed(2);
            default:
                return "N/A";
        }
    }

    /**
     * Opens the JDV in a separate tab
     *
     * @returns {void}
     */
    function openJDV() {
        const hubOctet = 10 + hub.getHubID();
        const fleetOctet = hub.getFleetID();
        const url = `http://${IPPrefix}.${fleetOctet}.${hubOctet}:40010`;
        window.open(url, "_blank");
    }

    /**
     * Opens the router page in a separate tab
     *
     * @returns {void}
     */
    function openRouterPage() {
        const fleetOctet = hub.getFleetID();
        const url = `http://${IPPrefix}.${fleetOctet}.1`;
        window.open(url, "_blank");
    }

    /**
     * Opens the upgrade page in a separate tab
     *
     * @returns {void}
     */
    function openUpgradePage() {
        const hubOctet = 10 + hub.getHubID();
        const fleetOctet = hub.getFleetID();
        const url = `http://${IPPrefix}.${fleetOctet}.${hubOctet}:9091`;
        window.open(url, "_blank");
    }

    return (
        <div className="node-details">
            <div className="details-heading">
                <div className="title-bar">
                    <h2>{`Hub ${hub.getHubID()}`}</h2>
                    <div className="close-button" onClick={handleClosePanel}>
                        ⨯
                    </div>
                </div>
            </div>

            <div className="accordions-container">
                <ThemeProvider theme={accordionTheme}>
                    <Accordion
                        expanded={jaiaContext.hubAccordionStates.quickLook}
                        onChange={() => {
                            handleAccordionClick(HubAccordionNames.QUICKLOOK);
                        }}
                        className="accordion-container"
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Quick Look</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <table>
                                <tbody>
                                    <HealthStatusLine healthState={hub.getHealthState()} />
                                    <tr>
                                        <td>Latitude</td>
                                        <td>
                                            {formatLatitude(hub.getHubSensors().getGPS()?.getLat())}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Longitude</td>
                                        <td>
                                            {formatLongitude(
                                                hub.getHubSensors().getGPS()?.getLon(),
                                            )}
                                        </td>
                                    </tr>
                                    <tr className={getStatusAgeClassName(hub.getStatusAge())}>
                                        <td>Status Age</td>
                                        <td>
                                            {convertMicrosecondsToSeconds(
                                                hub.getStatusAge(),
                                            ).toFixed(1)}{" "}
                                            s
                                        </td>
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
                                        <td>
                                            {hub.getLinuxHardwareStatus()?.wifi
                                                ?.link_quality_percentage + " %"}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>

                <ThemeProvider theme={accordionTheme}>
                    <Accordion
                        expanded={jaiaContext.hubAccordionStates.commands}
                        onChange={() => {
                            handleAccordionClick(HubAccordionNames.COMMANDS);
                        }}
                        className="accordion-container"
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Commands</Typography>
                        </AccordionSummary>
                        <AccordionDetails className="accordion-details-buttons">
                            <Button className="jaia-button">
                                <Icon path={mdiPower} title="Shutdown" />
                            </Button>
                            <Button className="jaia-button">
                                <Icon path={mdiRestartAlert} title="Reboot" />
                            </Button>
                            <Button className="jaia-button">
                                <Icon path={mdiRestart} title="Restart Services" />
                            </Button>
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>

                <ThemeProvider theme={accordionTheme}>
                    <Accordion
                        expanded={jaiaContext.hubAccordionStates.links}
                        onChange={() => {
                            handleAccordionClick(HubAccordionNames.LINKS);
                        }}
                        className="accordion-container"
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Links</Typography>
                        </AccordionSummary>
                        <AccordionDetails className="accordion-details-buttons">
                            <Button className="jaia-button" onClick={() => openJDV()}>
                                <Icon path={mdiChartLine} title="JDV" />
                            </Button>

                            <Button className="jaia-button" onClick={() => openRouterPage()}>
                                <Icon path={mdiWifiCog} title="Router"></Icon>
                            </Button>

                            <Button className="jaia-button" onClick={() => openUpgradePage()}>
                                <Icon path={mdiWrenchCog} title="Upgrade"></Icon>
                            </Button>
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>
            </div>
        </div>
    );
}
