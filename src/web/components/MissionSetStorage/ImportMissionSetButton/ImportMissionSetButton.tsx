import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { DialogActions } from "../../../types/context-types";
import { ImportMissionSetDialog } from "./ImportMissionSetDialog";

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
     * Closes the dialog and dispatches an event based on the button clicked
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            //jaiaDispatch({ type: JaiaActions.LOAD_MISSION_SET, missionSetName: props.saveName });
            console.log("Import Missions Set Action");
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
