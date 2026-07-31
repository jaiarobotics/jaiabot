import { useState } from "react";
import { DialogActions } from "../../../../types/context-types";
import { deleteFromHub } from "../mission-set-storage";
import { DisabledCodes } from "./delete-messages";
import { DeleteMissionSetDialog } from "./DeleteMissionSetDialog";

interface Props {
    saveName: string;
    savedNames: string[];
    clearSaveName: () => void;
    onDeleted: () => void;
}

/**
 * Produces the delete mission set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function DeleteMissionSetButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Checks the mission set and applies the appropriate disable code
     *
     * @returns {DisabledCodes} The applicable disabled code based on the mission set conditions
     */
    const getDisabledCode = () => {
        if (!props.saveName.trim()) return DisabledCodes.NO_NAME;
        if (!props.savedNames.includes(props.saveName.trim())) return DisabledCodes.FILE_NOT_FOUND;
        return DisabledCodes.NONE;
    };

    /**
     * Displays dialog before deleting the mission set
     *
     * @returns {void}
     */
    const onButtonClick = () => {
        setIsDialogVisible(true);
    };

    /**
     * Closes the dialog and then acts based on the button clicked
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     *
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            deleteFromHub(props.saveName.trim()).then(() => {
                props.clearSaveName();
                props.onDeleted();
            });
        }
    };

    return (
        <div>
            <button aria-label={"delete-mission-set"} onClick={() => onButtonClick()}>
                Delete
            </button>
            <DeleteMissionSetDialog
                isVisible={isDialogVisible}
                saveName={props.saveName}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}
