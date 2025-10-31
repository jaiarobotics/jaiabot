import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { ImportMissionSetDialog } from "./ImportMissionSetDialog";
import { loadSnapshotFromFile } from "../mission-set-storage";

interface Props {
    onClose: () => void;
}

/**
 * Produces the import mission set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function ImportMissionSetButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Displays dialog before importing the mission set
     *
     * @returns {void}
     */
    const onButtonClick = () => {
        setIsDialogVisible(true);
    };

    /**
     * Closes the dialog and dispatches an event with the mission set snapshot
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            const missionSetSnapshot = await loadSnapshotFromFile();
            if (missionSetSnapshot) {
                jaiaDispatch({
                    type: JaiaActions.LOAD_MISSION_SET,
                    missionSetSnapshot: missionSetSnapshot,
                });
            } else {
                console.warn("No valid mission set file selected");
            }

            props.onClose();
        }
    };

    return (
        <div>
            <button aria-label={"import-mission-set"} onClick={() => onButtonClick()}>
                Import
            </button>
            <ImportMissionSetDialog isVisible={isDialogVisible} onClose={onDialogClose} />
        </div>
    );
}
