import { useState } from "react";
import { DialogActions } from "../../../../types/context-types";
import { deleteFromHub } from "../zone-storage";
import { DisabledCodes } from "./delete-messages";
import { DeleteZoneDialog } from "./DeleteZoneDialog";

interface Props {
    saveName: string;
    savedNames: string[];
    clearSaveName: () => void;
    onDeleted: () => void;
}

/**
 * Produces the delete zone set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function DeleteZoneButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Checks the zone set and applies the appropriate disabled code.
     *
     * @returns {DisabledCodes} The applicable disabled code based on the zone set conditions.
     */
    const getDisabledCode = () => {
        if (!props.saveName.trim()) return DisabledCodes.NO_NAME;
        if (!props.savedNames.includes(props.saveName.trim())) return DisabledCodes.FILE_NOT_FOUND;
        return DisabledCodes.NONE;
    };

    /**
     * Displays dialog before deleting the zone set.
     *
     * @returns {void}.
     */
    const onButtonClick = () => {
        setIsDialogVisible(true);
    };

    /**
     * Closes the dialog and then acts based on the button clicked.
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked.
     * @returns {void}.
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
            <button aria-label={"delete-zone-set"} onClick={() => onButtonClick()}>
                Delete
            </button>
            <DeleteZoneDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                saveName={props.saveName}
                onClose={onDialogClose}
            />
        </div>
    );
}
