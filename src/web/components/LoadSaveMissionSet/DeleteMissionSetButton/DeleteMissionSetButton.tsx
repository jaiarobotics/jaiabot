import { useState } from "react";
import { missionSet } from "../../../data/mission_set/mission-set";
import { listSavedMissionSets } from "../../../utils/local-storage";
import { DeleteMissionSetDialog } from "./DeleteMissionSetDialog";
import { DisabledCodes } from "./delete-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiDelete } from "@mdi/js";

import { DialogActions } from "../../../types/context-types";

interface Props {
    saveName: string;
}
/**
 * Produces the delete mission set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function LoadMissionSetButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    /**
     * Forms the style of the button
     *
     * @returns {string} General class name jaia-button plus enable/disable factor
     */
    const getClassName = () => {
        let className = "jaia-button";

        // if (getDisabledCode() !== DisabledCodes.NONE) {
        //     className += " disabled";
        // }

        return className;
    };

    /**
     * Checks the Mission Set and applies the appropriate disable code
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Mission Set conditions
     */
    const getDisabledCode = () => {
        if (!listSavedMissionSets().includes(props.saveName)) return DisabledCodes.FILE_NOT_FOUND;
        return DisabledCodes.CONFIRM;
    };

    /**
     * Displays dialog before loading the mission set
     *
     * @returns {void}
     */
    const onButtonClick = async () => {
        setIsDialogVisible(true);
    };

    /**
     * Closes the dialog box then acts based on the button clicked
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     *
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            missionSet.deleteFromLocalStorage(props.saveName);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"load-mission-set"}
                onClick={() => onButtonClick()}
            >
                <Icon path={mdiDelete} title="Delete Mission Set" />
            </Button>
            <DeleteMissionSetDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}
