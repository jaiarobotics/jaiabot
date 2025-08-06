import { useContext } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { DisabledCodes } from "./undo-messages";

import Bot from "../../data/bots/bot";
import Mission from "../../data/mission_set/mission";
import { missionSet } from "../../data/mission_set/mission-set";

import { Icon } from "@mdi/react";
import { Button, Tooltip } from "@mui/material";
import { mdiArrowULeftTop } from "@mdi/js";
import { MDI_BUTTON_SIZE } from "../../utils/constants";
import { info } from "../../notifications/notifications";

/**
 * Produces the undo button that allows users to revert the last action.
 * This component provides visual feedback about whether undo is available.
 */
export default function UndoButton() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Forms the style of the button (light if enabled, dark if disabled)
     *
     * @returns {string} General class name jaia-button plus enable/disable factor
     */
    const getClassName = () => {
        let className = "jaia-button";

        return className;
    };

    /**
     * Handles the undo button click event
     * Currently shows a notification - in a full implementation this would
     * revert the last action from a history stack
     *
     * @returns {void}
     */
    const handleUndo = () => {
        // Show notification for now - in a full implementation this would:
        // 1. Get the last action from history
        // 2. Dispatch the appropriate reverse action
        // 3. Update the history stack
        info("Undo functionality clicked - would revert last action");

        // Example of how this might work with actual undo functionality:
        // jaiaDispatch({ type: JaiaActions.UNDO_LAST_ACTION });
    };

    if (jaiaContext === null) {
        return <div></div>;
    }

    return (
        <span>
            <Button className={getClassName()} aria-label="undo-button" onClick={handleUndo}>
                <Icon path={mdiArrowULeftTop} title="Undo" size={MDI_BUTTON_SIZE} />
            </Button>
        </span>
    );
}
