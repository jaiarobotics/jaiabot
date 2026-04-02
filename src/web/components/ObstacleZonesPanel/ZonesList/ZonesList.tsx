import { useContext } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Icon from "@mdi/react";
import { mdiTrashCan } from "@mdi/js";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    ThemeProvider,
} from "@mui/material";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import ZoneAssignMenu from "../ZoneAssignMenu/ZoneAssignMenu";
import { MDI_BUTTON_SIZE, UNASSIGNED_ID } from "../../../utils/constants";
import { accordionTheme } from "../../../utils/style";

import "./ZonesList.less";

export default function ZonesList() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const zones = jaiaContext.exclusionZoneSet.getZones();

    if (zones.size === 0) return null;

    return (
        <div id="zones-list">
            {Array.from(zones.entries()).map(([zoneID, zone]) => {
                const assignedBotID = jaiaContext.exclusionZoneSet.getAssignment(zoneID);
                const label = zone.label ?? `Zone ${zoneID}`;
                const assignment =
                    assignedBotID === UNASSIGNED_ID ? "All Bots" : `Bot-${assignedBotID}`;

                return (
                    <ThemeProvider theme={accordionTheme} key={zoneID}>
                        <Accordion className="zone-accordion">
                            <AccordionSummary
                                className="zone-accordion-summary"
                                expandIcon={<ExpandMoreIcon />}
                            >
                                <div className="zone-accordion-title">
                                    <p>{label}</p>
                                    <p className="zone-assignment">{assignment}</p>
                                </div>
                            </AccordionSummary>
                            <AccordionDetails className="zone-accordion-details">
                                <div className="zone-accordion-row">
                                    <ZoneAssignMenu zoneID={zoneID} />
                                    <Button
                                        className="jaia-button"
                                        aria-label={`delete-zone-${zoneID}`}
                                        onClick={() =>
                                            jaiaDispatch({
                                                type: JaiaActions.DELETE_EXCLUSION_ZONE,
                                                zoneID,
                                            })
                                        }
                                    >
                                        <Icon
                                            path={mdiTrashCan}
                                            size={MDI_BUTTON_SIZE}
                                            title="Delete zone"
                                        />
                                    </Button>
                                </div>
                            </AccordionDetails>
                        </Accordion>
                    </ThemeProvider>
                );
            })}
        </div>
    );
}
