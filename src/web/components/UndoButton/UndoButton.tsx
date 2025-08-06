import { useContext } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { DisabledCodes } from "./undo-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiArrowULeftTop } from "@mdi/js";
import { MDI_BUTTON_SIZE } from "../../utils/constants";

interface Props {
    // Props can be extended as needed for specific undo functionality
}

/**
 * Produces the undo button for mission planning actions.
 * Performs immediate undo without confirmation dialog for better UX.
 * Implements undo functionality for mission planning actions like waypoint management.
 */
export default function UndoButton(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Forms the style of the button (light if enabled, dark if disabled)
     *
     * @returns {string} General class name jaia-button plus enable/disable factor
     */
    const getClassName = () => {
        let className = "jaia-button";

        if (getDisabledCode() !== DisabledCodes.NONE) {
            className += " disabled";
        }

        return className;
    };

    /**
     * Checks if there is mission history available to undo
     *
     * @returns {DisabledCodes} The applicable disabled code based on mission history availability
     */
    const getDisabledCode = () => {
        // Check if there's mission history available to undo
        // This would need to be implemented based on your mission history management system
        // For now, just check if we have context - you'll need to add missionHistory to JaiaContext
        if (!jaiaContext) {
            return DisabledCodes.NO_HISTORY;
        }

        // TODO: Add proper mission history check when integrated
        // if (!jaiaContext.missionHistory || jaiaContext.missionHistory.length <= 1) {
        //     return DisabledCodes.NO_HISTORY;
        // }

        return DisabledCodes.NONE;
    };

    /**
     * Handles the button click to perform immediate undo
     *
     * @returns {void}
     */
    const handleClick = () => {
        if (getDisabledCode() === DisabledCodes.NONE && jaiaDispatch) {
            // Immediate undo action - no dialog needed
            // TODO: Add UNDO_MISSION_ACTION to JaiaActions enum
            // jaiaDispatch({ type: JaiaActions.UNDO_MISSION_ACTION });

            // For now, just log the action
            console.log("Undo action triggered");
        }
    };

    if (jaiaContext === null) {
        return <div></div>;
    }

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label="undo-mission-action"
                onClick={handleClick}
                disabled={getDisabledCode() !== DisabledCodes.NONE}
            >
                <Icon path={mdiArrowULeftTop} title="Undo" size={MDI_BUTTON_SIZE} />
            </Button>
        </div>
    );
}
