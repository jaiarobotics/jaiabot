import { useContext, useState } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import { DeleteMissionDialog } from "./DeleteMissionDialog";
import { DisabledCodes } from "./delete-mission-messages";
import { DialogActions } from "../../../types/context-types";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiDelete } from "@mdi/js";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";

interface Props {
    deleteAll: boolean;
    missionID?: number;
}

/**
 * Produces the delete mission button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function DeleteMissionButton(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const [isDialogVisible, setIsDialogVisible] = useState(false);

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
     * Checks the Bot's state and decides what disabled code (if any) applies
     * based on the button conditions
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Bot and button conditions
     */
    const getDisabledCode = () => {
        // Bot not assigned to mission
        if (!props.deleteAll && !props.missionID) {
            return DisabledCodes.NO_MISSION;
        }

        if (jaiaContext.missions.size === 0) {
            return DisabledCodes.NO_MISSION;
        }

        return DisabledCodes.NONE;
    };

    /**
     * Closes the dialog box then acts based on the type of button clicked
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            if (props.deleteAll) {
                jaiaDispatch({ type: JaiaActions.DELETE_ALL_MISSIONS });
            } else if (props.missionID) {
                jaiaDispatch({ type: JaiaActions.DELETE_MISSION, missionID: props.missionID });
            }
        }
    };

    if (jaiaContext === null) {
        return <div></div>;
    }

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={props.deleteAll ? "delete-all-missions" : "delete-mission"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon
                    path={mdiDelete}
                    title={props.deleteAll ? "Delete All Missions" : "Delete Mission"}
                    size={MDI_BUTTON_SIZE}
                />
            </Button>
            <DeleteMissionDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
                deleteAll={props.deleteAll}
            />
        </div>
    );
}
