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
    onClose: () => void;
}
/**
 * Produces the save mission set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function SaveMissionSetButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Checks the mission set and applies the appropriate disable code
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Mission Set conditions
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
    const onButtonClick = () => {
        if (getDisabledCode() !== DisabledCodes.NONE) {
            setIsDialogVisible(true);
        } else {
            onDialogClose(DialogActions.CONFIRMED);
        }
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
            missionSet.saveToLocalStorage(props.saveName);
            props.onClose();
        }
    };

    return (
        <div>
            <button aria-label={"save-mission-set"} onClick={() => onButtonClick()}>
                Save
            </button>
            <SaveMissionSetDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                saveName={props.saveName}
                onClose={onDialogClose}
            />
        </div>
    );
}
