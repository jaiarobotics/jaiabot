import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { saveSnapshotToHub } from "../../MissionSetStorage/mission-set-storage";
import { combineMissionSets } from "../mission-set-editor";
import { MissionSetSnapshot } from "../../../../data/mission_set/mission-set";
import { DisabledCodes } from "./save-and-load-messages";
import { SaveAndLoadDialog } from "./SaveAndLoadDialog";

interface Props {
    editorName: string;
    combinedMissionNames: string[];
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>;
    savedNames: string[];
    onClose: () => void;
}

/**
 * Button that saves the combined mission set to the hub and loads it into the active mission.
 * Shows a confirmation dialog before saving; shows an alert dialog if prerequisites are not met.
 */
export default function SaveAndLoadButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /** Returns a DisabledCode indicating why the button is blocked, or NONE if all prerequisites are met. */
    const getDisabledCode = (): DisabledCodes => {
        if (!props.editorName.trim()) return DisabledCodes.NO_NAME;
        if (props.combinedMissionNames.length < 2) return DisabledCodes.NO_MISSIONS;
        if (props.savedNames.includes(props.editorName.trim())) return DisabledCodes.OVERWRITE;
        return DisabledCodes.NONE;
    };

    const onButtonClick = () => {
        setIsDialogVisible(true);
    };

    /** Closes the confirmation dialog; on confirm, combines, saves, and dispatches the new mission set. */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            const name = props.editorName.trim();
            const missionSetSnapshot = combineMissionSets(
                props.combinedMissionNames,
                name,
                props.missionSetSnapshotCache,
            );
            try {
                await saveSnapshotToHub(name, missionSetSnapshot);
            } catch (error) {
                console.error("Failed to save combined mission set to the hub:", error);
                return;
            }
            jaiaDispatch({
                type: JaiaActions.LOAD_MISSION_SET,
                missionSetSnapshot: missionSetSnapshot,
            });
            props.onClose();
        }
    };

    return (
        <div>
            <button aria-label="save-and-load-mission-set" onClick={onButtonClick}>
                Save and Load
            </button>
            <SaveAndLoadDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                editorName={props.editorName}
                onClose={onDialogClose}
            />
        </div>
    );
}
