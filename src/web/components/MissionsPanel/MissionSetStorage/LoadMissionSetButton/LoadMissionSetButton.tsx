import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { loadSnapshotFromHub, LoadResultType } from "../mission-set-storage";
import { DisabledCodes } from "./load-messages";
import { LoadMissionSetDialog } from "./LoadMissionSetDialog";

interface Props {
    saveName: string;
    savedNames: string[];
    onClose: () => void;
}

/**
 * Produces the load mission set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function LoadMissionSetButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [disabledCode, setDisabledCode] = useState(DisabledCodes.NONE);

    /**
     * Checks the mission set and returns the appropriate disabled code
     *
     * @returns {DisabledCodes} The applicable disabled code based on the mission set conditions
     */
    const getInitialDisabledCode = () => {
        if (!props.saveName.trim()) return DisabledCodes.NO_NAME;
        if (!props.savedNames.includes(props.saveName.trim())) return DisabledCodes.FILE_NOT_FOUND;
        return DisabledCodes.NONE;
    };

    /**
     * Displays dialog before loading the mission set
     *
     * @returns {void}
     */
    const onButtonClick = () => {
        setDisabledCode(getInitialDisabledCode());
        setIsDialogVisible(true);
    };

    /**
     * Closes the dialog and dispatches an event with the mission set snapshot.
     * Re-opens the dialog with an old format warning if the loaded mission set
     * required migration.
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            const loadResult = await loadSnapshotFromHub(props.saveName);
            if (loadResult.snapshot) {
                jaiaDispatch({
                    type: JaiaActions.LOAD_MISSION_SET,
                    missionSetSnapshot: loadResult.snapshot,
                });

                if (loadResult.resultType === LoadResultType.OLD_FORMAT) {
                    setDisabledCode(DisabledCodes.OLD_FORMAT);
                    setIsDialogVisible(true);
                    return;
                }

                props.onClose();
            }
        }
    };

    return (
        <div>
            <button aria-label={"load-mission-set"} onClick={() => onButtonClick()}>
                Load
            </button>
            <LoadMissionSetDialog
                isVisible={isDialogVisible}
                disabledCode={disabledCode}
                saveName={props.saveName}
                onClose={onDialogClose}
            />
        </div>
    );
}
