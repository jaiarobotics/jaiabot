// React
import { useContext } from "react";

// Jaia
import MissionsList from "./MissionsList/MissionsList";
import DeleteMissionButton from "../../components/__buttons__/DeleteMissionButton/DeleteMissionButton";
import MissionSpeedSliders from "./MissionSpeedSliders/MissionSpeedSliders";
import MissionSetStorageButton from "./MissionSetStorage/MissionSetStorageButton";
import MissionSetEditorButton from "./MissionSetEditor/MissionSetEditorButton";
import MissionSetRoutingButton from "./MissionSetRoutingButton/MissionSetRoutingButton";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { MDI_BUTTON_SIZE } from "../../utils/constants";
import { scrollMissionsList } from "../../utils/style";
import { buildZoneGeometry } from "../../utils/routing/router";
import { getRoutingLevel } from "../../utils/routing/routing-status";

// MUI | MDI
import Button from "@mui/material/Button";
import Icon from "@mdi/react";
import { mdiAutoFix, mdiPlus } from "@mdi/js";

import "./MissionsPanel.less";

interface Props {
    missionSetName?: string;
    numOfMissions?: number;
    handleNameChange?: (name: string) => void;
}

/**
 * Renders a panel for operators to manage missions
 */
export default function MissionsPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches the action to create a new mission when an operator clicks the add mission button
     *
     * @returns {void}
     */
    const handleAddMissionClick = () => {
        jaiaDispatch({ type: JaiaActions.ADD_MISSION });
        scrollMissionsList();
    };

    /**
     * Dispatches the action to assign available Bots to open missions when an operator selects the magic wand button
     *
     * @returns {void}
     */
    const handleAutoAssignClick = () => {
        jaiaDispatch({ type: JaiaActions.AUTO_ASSIGN_MISSIONS });
    };

    /**
     * Dispatches action to update the mission set name
     *
     * @param {string} name Input entered by operator
     * @returns {void}
     */
    const handleNameChange = (name: string) => {
        jaiaDispatch({
            type: JaiaActions.CHANGE_MISSION_SET_NAME,
            missionSetName: name,
        });
    };

    const geometry = buildZoneGeometry(jaiaContext.exclusionZoneSet.getZones());
    const routingLevels = new Map(
        Array.from(jaiaContext.missionSet.getMissions().values(), (mission) => [
            mission.getMissionID(),
            getRoutingLevel(mission, geometry),
        ]),
    );

    return (
        <div className="jaia-panel missions-panel">
            <div className="missions-panel-title">
                <div className="jaia-panel-title">Mission Set</div>
                <MissionSetRoutingButton routingLevels={routingLevels} />
            </div>
            <MissionSpeedSliders />
            <div className="jaia-button-row">
                <Button
                    className="jaia-button"
                    aria-label="add-mission"
                    onClick={() => handleAddMissionClick()}
                >
                    <Icon path={mdiPlus} size={MDI_BUTTON_SIZE} title="Add mission" />
                </Button>
                <DeleteMissionButton deleteAll={true} />
                <MissionSetStorageButton missionSetName={jaiaContext.missionSet.getName()} />
                <MissionSetEditorButton />
                <Button
                    className="jaia-button"
                    aria-label="auto-assign-bots"
                    onClick={() => handleAutoAssignClick()}
                >
                    <Icon path={mdiAutoFix} size={MDI_BUTTON_SIZE} title="Auto assign Bots" />
                </Button>
            </div>
            <MissionSetName
                missionSetName={jaiaContext.missionSet.getName()}
                numOfMissions={jaiaContext.missionSet.getMissions().size}
                handleNameChange={handleNameChange}
            />
            <MissionsList routingLevels={routingLevels} />
        </div>
    );
}

/**
 * Renders the input bar to enter a mission set name
 */
function MissionSetName(props: Props) {
    if (props.numOfMissions > 0) {
        return (
            <input
                className="set-name"
                placeholder="Mission Set Name"
                value={props.missionSetName}
                onChange={(event) => props.handleNameChange(event.target.value)}
            />
        );
    }
    return null;
}
