import { useContext, useState } from "react";
import { missionsManager } from "../../../../data/missions_manager/missions-manager";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import {
    listSavedMissionSets,
    loadSnapshotFromLocalStorage,
    LoadResultType,
} from "../mission-set-storage";
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
    const [disabledCode, setDisabledCode] = useState(DisabledCodes.NONE);

    /**
     * Checks the mission set and returns the appropriate disabled code
     *
     * @returns {DisabledCodes} The applicable disabled code based on the mission set conditions
     */
    const getInitialDisabledCode = () => {
        if (!listSavedMissionSets().includes(props.saveName)) return DisabledCodes.FILE_NOT_FOUND;
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
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            const loadResult = loadSnapshotFromLocalStorage(props.saveName);
            jaiaDispatch({
                type: JaiaActions.LOAD_MISSION_SET,
                missionSetSnapshot: loadResult.snapshot,
            });

            missionsManager.autoAssign();

            if (loadResult.resultType === LoadResultType.OLD_FORMAT) {
                setDisabledCode(DisabledCodes.OLD_FORMAT);
                setIsDialogVisible(true);
                return;
            }

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
                disabledCode={disabledCode}
                saveName={props.saveName}
                onClose={onDialogClose}
            />
        </div>
    );
}
