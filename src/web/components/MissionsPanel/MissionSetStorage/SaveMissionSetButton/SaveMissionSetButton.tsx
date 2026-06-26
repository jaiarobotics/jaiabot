import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { missionSet } from "../../../../data/mission_set/mission-set";
import { DialogActions } from "../../../../types/context-types";
import { DisabledCodes } from "./save-messages";
import { SaveMissionSetDialog } from "./SaveMissionSetDialog";
import { saveToHub } from "../mission-set-storage";

interface Props {
    saveName: string;
    savedNames: string[];
    onSaved: () => void;
}

/**
 * Produces the save mission set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function SaveMissionSetButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Checks the mission set and applies the appropriate disable code
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Mission Set conditions
     */
    const getDisabledCode = () => {
        if (missionSet.getMissions().size == 0) return DisabledCodes.NO_MISSIONS;
        if (props.saveName == "") return DisabledCodes.NO_NAME;
        if (props.savedNames.includes(props.saveName.trim())) return DisabledCodes.OVERWRITE;
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
            saveToHub(props.saveName.trim()).then(() => {
                jaiaDispatch({
                    type: JaiaActions.CHANGE_MISSION_SET_NAME,
                    missionSetName: props.saveName.trim(),
                });
                props.onSaved();
            });
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
