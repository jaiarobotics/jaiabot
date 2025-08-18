import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { DialogActions } from "../../../types/context-types";
import { listSavedMissionSets } from "../../../utils/local-storage";
import { DisabledCodes } from "./load-messages";
import { LoadMissionSetDialog } from "./LoadMissionSetDialog";

interface Props {
    saveName: string;
    onClose: () => void;
}
/**
 * Produces the load mission set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function LoadMissionSetButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Checks the mission set and applies the appropriate disable code
     *
     * @returns {DisabledCodes} The applicable disabled code based on the mission set conditions
     */
    const getDisabledCode = () => {
        if (!listSavedMissionSets().includes(props.saveName)) return DisabledCodes.FILE_NOT_FOUND;
        return DisabledCodes.NONE;
    };

    /**
     * Displays dialog before loading the mission set
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
     *
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            jaiaDispatch({ type: JaiaActions.LOAD_MISSION_SET, missionSetName: props.saveName });
            props.onClose();
        }
    };

    return (
        <div>
            <button aria-label={"load-mission-set"} onClick={() => onButtonClick()}>
                Load
            </button>
            <LoadMissionSetDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                saveName={props.saveName}
                onClose={onDialogClose}
            />
        </div>
    );
}
