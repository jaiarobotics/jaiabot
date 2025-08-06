import { useContext } from "react";

import { JaiaContext, JaiaDispatchContext, canUndoMission } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { DisabledCodes, messages } from "./undo-messages";
import { ButtonNames } from "../../types/context-types";

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

        if (getDisabledCode() !== DisabledCodes.NONE) {
            className += " disabled";
        }

        return className;
    };

    /**
     * Checks the application state and decides what disabled code (if any) applies
     * based on whether there are actions to undo
     *
     * @returns {DisabledCodes} The applicable disabled code based on action history
     */
    const getDisabledCode = () => {
        if (!canUndoMission(jaiaContext)) {
            return DisabledCodes.NO_HISTORY;
        }

        return DisabledCodes.NONE;
    };

    /**
     * Restores the previous mission planning state by removing the last item from the history array
     * and setting the displayed mission to the new last item of the history array
     *
     * @returns {void}
     *
     * @notes
     * Adapted from the original CommandControl implementation. Dispatches an undo action
     * to restore the previous mission state and closes any open waypoint panels since they
     * could apply to waypoints that no longer exist.
     */
    const handleUndo = () => {
        if (getDisabledCode() !== DisabledCodes.NONE) {
            return;
        }

        if (jaiaContext.missionHistory.length === 1) {
            // If only one history entry exists, we're at the beginning
            jaiaDispatch({ type: JaiaActions.UNDO_LAST_ACTION });
            info("There is no more history to undo");
            return;
        }

        // Perform the undo operation
        jaiaDispatch({ type: JaiaActions.UNDO_LAST_ACTION });

        // Close waypoint panel since it could apply to a waypoint that no longer exists
        if (jaiaContext.visiblePanel === ButtonNames.WAYPOINT_PANEL) {
            // The undo action will handle closing panels, but we can add specific logic here if needed
        }

        info("Mission state restored to previous version");
    };

    /**
     * Gets the tooltip message based on the current disabled state
     *
     * @returns {string} The appropriate tooltip message
     */
    const getTooltipMessage = () => {
        const disabledCode = getDisabledCode();
        return messages.get(disabledCode) || "Undo last action";
    };

    if (jaiaContext === null) {
        return <div></div>;
    }

    return (
        <Tooltip title={getTooltipMessage()} arrow>
            <span>
                <Button
                    className={getClassName()}
                    aria-label="undo-button"
                    onClick={handleUndo}
                    disabled={getDisabledCode() !== DisabledCodes.NONE}
                >
                    <Icon path={mdiArrowULeftTop} title="Undo" size={MDI_BUTTON_SIZE} />
                </Button>
            </span>
        </Tooltip>
    );
}
