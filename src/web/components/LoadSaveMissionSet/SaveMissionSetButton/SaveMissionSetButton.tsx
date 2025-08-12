import { useState } from "react";
import { missionSet } from "../../../data/mission_set/mission-set";
import { listSavedMissionSets } from "../../../utils/local-storage";
import { SaveMissionSetDialog } from "./SaveMissionSetDialog";
import { DisabledCodes } from "./save-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiFolderDownload } from "@mdi/js";

import { DialogActions } from "../../../types/context-types";

interface Props {
    saveName: string;
}
/**
 * Produces the save mission set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function SaveMissionSetButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    /**
     * Forms the style of the button (light if enabled, dark if disabled)
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
     * Checks the Bot's state and decides what disabled code (if any) applies based on the button conditions
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Bot and button conditions
     */
    const getDisabledCode = () => {
        if (missionSet.getMissions().size == 0) return DisabledCodes.NO_MISSIONS;
        if (props.saveName == "") return DisabledCodes.NO_NAME;
        if (listSavedMissionSets().includes(props.saveName)) return DisabledCodes.OVERWRITE;
        return DisabledCodes.NONE;
    };

    /**
     * Displays dialog if a warning condition exist or saves the mission set
     *
     * @returns {void}
     */
    const onButtonClick = async () => {
        if (getDisabledCode() !== DisabledCodes.NONE) {
            setIsDialogVisible(true);
        } else {
            onDialogClose(DialogActions.CONFIRMED);
        }
    };

    /**
     * Closes the dialog box then acts based on the type of button clicked
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     *
     * @notes
     * After refactoring the command structure, issue the activate command
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            missionSet.saveToLocalStorage(props.saveName);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"save-mission-set"}
                onClick={() => onButtonClick()}
            >
                <Icon path={mdiFolderDownload} title="Save Mission Set" />
            </Button>
            <SaveMissionSetDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}
