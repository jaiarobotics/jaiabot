import React, { useContext, useEffect } from "react";
import { JaiaActions } from "../../context/jaia-actions";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaAction, HubAccordionNames } from "../../types/context-types";
import { NodeTypes } from "../../types/jaia-system-types";
import { HealthState } from "../../types/protobuf-types";
import { accordionTheme, addDropdownListener } from "../../utils/style";
import { convertMicrosecondsToSeconds } from "../../shared/Utilities";
import { CommandTrackingEntry } from "../../shared/PortalStatus";

import Accordion from "@mui/material/Accordion";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import { ThemeProvider } from "@mui/material";

import "./FleetDetails.less";

function healthToText(health?: HealthState) {
    switch (health) {
        case HealthState.HEALTH__FAILED:
            return "FAILED";
        case HealthState.HEALTH__DEGRADED:
            return "WARNING";
        case HealthState.HEALTH__OK:
        default:
            return "OK";
    }
}

function linkToText(link?: string) {
    if (!link) {
        return "N/A";
    }
    return link.replace("LINK_", "");
}

export default function FleetDetails() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);

    useEffect(() => {
        addDropdownListener("accordion-container", "fleet-details-accordions-container");
    }, []);

    const selectedNode = jaiaContext.jaiaGlobal.getSelectedNode();
    if (selectedNode.type !== NodeTypes.FLEET) {
        return;
    }

    const hubs = Array.from(jaiaContext.hubs.getHubs().values());
    const bots = Array.from(jaiaContext.bots.getBots().values());
    const fleetID = selectedNode.id || hubs[0]?.getFleetID() || 1;

    const botHealth =
        bots.length === 0
            ? HealthState.HEALTH__OK
            : bots.reduce((maxHealth, bot) =>
                  bot.getHealthState() > maxHealth ? bot.getHealthState() : maxHealth,
              HealthState.HEALTH__OK);
    const hubHealth =
        hubs.length === 0
            ? HealthState.HEALTH__OK
            : hubs.reduce((maxHealth, hub) =>
                  hub.getHealthState() > maxHealth ? hub.getHealthState() : maxHealth,
              HealthState.HEALTH__OK);
    const fleetHealth = botHealth > hubHealth ? botHealth : hubHealth;

    const fleetStatusAge = Math.max(
        0,
        ...hubs.map((hub) => hub.getStatusAge() || 0),
        ...bots.map((bot) => bot.getStatusAge() || 0),
    );

    const commandTracking = jaiaContext.jaiaGlobal.getCommandTracking();
    const rollups = commandTracking?.rollups ?? [];
    const commands = commandTracking?.commands ?? [];

    function handleClosePanel() {
        jaiaDispatch({ type: JaiaActions.CLOSED_DETAILS });
    }

    function handleAccordionClick(accordionName: HubAccordionNames) {
        jaiaDispatch({
            type: JaiaActions.CLICKED_HUB_ACCORDION,
            hubAccordionName: accordionName,
        });
    }

    function getEntryStatus(entry: CommandTrackingEntry) {
        if (!entry.acked) {
            return "PENDING";
        }
        return entry.ack_result ?? "UNKNOWN";
    }

    return (
        <div className="node-details fleet-details">
            <div className="details-heading">
                <div className="title-bar">
                    <h2>{`Fleet ${fleetID}`}</h2>
                    <div className="close-button" onClick={handleClosePanel}>
                        ⨯
                    </div>
                </div>
            </div>

            <div className="accordions-container" id="fleet-details-accordions-container">
                <ThemeProvider theme={accordionTheme}>
                    <Accordion
                        expanded={jaiaContext.hubAccordionStates.quickLook}
                        onChange={() => {
                            handleAccordionClick(HubAccordionNames.QUICKLOOK);
                        }}
                        className="accordion-container"
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} className="accordion-summary">
                            <Typography>Quick Look</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <table>
                                <tbody>
                                    <tr>
                                        <td>Total Bots</td>
                                        <td>{bots.length}</td>
                                    </tr>
                                    <tr>
                                        <td>Bot Health</td>
                                        <td>{healthToText(botHealth)}</td>
                                    </tr>
                                    <tr>
                                        <td>Total Hubs</td>
                                        <td>{hubs.length}</td>
                                    </tr>
                                    <tr>
                                        <td>Hub Health</td>
                                        <td>{healthToText(hubHealth)}</td>
                                    </tr>
                                    <tr>
                                        <td>Fleet Health</td>
                                        <td>{healthToText(fleetHealth)}</td>
                                    </tr>
                                    <tr>
                                        <td>Status Age</td>
                                        <td>{convertMicrosecondsToSeconds(fleetStatusAge).toFixed(1)} s</td>
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
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} className="accordion-summary">
                            <Typography>Command Delivery</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <div className="fleet-command-section">
                                <h4>Fleet-wide rollup</h4>
                                {rollups.length === 0 && <p>No fleet-wide command rollups yet.</p>}
                                {rollups.map((rollup) => (
                                    <p key={rollup.group_id} className="command-rollup-row">
                                        {`${rollup.ack_success}/${rollup.total_targets} bots ACKed, ${rollup.ack_failure} failed, ${rollup.pending} pending (${rollup.command_type})`}
                                    </p>
                                ))}
                            </div>
                            <div className="fleet-command-section">
                                <h4>Recent command results</h4>
                                <table className="fleet-command-table">
                                    <thead>
                                        <tr>
                                            <th>Bot</th>
                                            <th>Command</th>
                                            <th>Status</th>
                                            <th>Link</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {commands.slice(0, 20).map((entry) => (
                                            <tr key={entry.command_key}>
                                                <td>{entry.bot_id}</td>
                                                <td>{entry.command_type}</td>
                                                <td>{getEntryStatus(entry)}</td>
                                                <td>{linkToText(entry.ack_link)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>
            </div>
        </div>
    );
}
