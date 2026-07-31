import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { ImportMissionSetDialog, DialogWarningType } from "./ImportMissionSetDialog";
import { LoadResultType, loadSnapshotFromFile } from "../mission-set-storage";

interface Props {
    onClose: () => void;
}

/**
 * Produces the import mission set button.
 * It manages the alert/confirm dialog that displays warnings to the user
 */
export default function ImportMissionSetButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [dialogWarningType, setDialogWarningType] = useState<DialogWarningType>(
        DialogWarningType.CLEAR_MISSIONS,
    );

    /**
     * Displays initial warning dialog before importing the mission set
     *
     * @returns {void}
     */
    const onButtonClick = () => {
        setDialogWarningType(DialogWarningType.CLEAR_MISSIONS);
        setIsDialogVisible(true);
    };

    /**
     * Dispatches an event with the mission set snapshot if the user
     * confirms they want to import and the file can be parsed
     *
     * Re-opens the dialog with secondary warnings if the user selects a
     * file from an old or invalid format.
     *
     * Closes the dialog when a file is imported or the close button
     * is pressed
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     *
     * @notes
     * The onClose from the parent is only called if the initial confirmation
     * for a mission set in the current format or the close button is pressed
     *
     */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            const loadResults = await loadSnapshotFromFile();
            if (loadResults.snapshot) {
                jaiaDispatch({
                    type: JaiaActions.LOAD_MISSION_SET,
                    missionSetSnapshot: loadResults.snapshot,
                });

                if (loadResults.resultType === LoadResultType.OLD_FORMAT) {
                    setDialogWarningType(DialogWarningType.OLD_FORMAT);
                    setIsDialogVisible(true);
                    return;
                }
            } else {
                setDialogWarningType(DialogWarningType.INVALID_FORMAT);
                setIsDialogVisible(true);
                console.warn("No valid mission set file selected");
                return;
            }
            props.onClose();
        }
    };

    return (
        <div>
            <button aria-label={"import-mission-set"} onClick={() => onButtonClick()}>
                Import
            </button>
            <ImportMissionSetDialog
                isVisible={isDialogVisible}
                warningType={dialogWarningType}
                onClose={onDialogClose}
            />
        </div>
    );
}
