import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { listSavedMissionSets } from "../../MissionSetStorage/mission-set-storage";
import { saveSnapshotToLocalStorage } from "../../MissionSetStorage/mission-set-storage";
import { combineMissionSets } from "../mission-set-editor";
import { MissionSetSnapshot } from "../../../../data/mission_set/mission-set";
import { DisabledCodes } from "./save-and-load-messages";
import { SaveAndLoadDialog } from "./SaveAndLoadDialog";

interface Props {
    editorName: string;
    combinedMissionNames: string[];
    missionSetSnapshotCache: Map<string, MissionSetSnapshot>;
    onClose: () => void;
}

/** Button that saves the combined mission set to local storage and loads it into the active mission. */
export default function SaveAndLoadButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    const getDisabledCode = (): DisabledCodes => {
        if (!props.editorName.trim()) return DisabledCodes.NO_NAME;
        if (props.combinedMissionNames.length < 2) return DisabledCodes.NO_MISSIONS;
        if (listSavedMissionSets().includes(props.editorName.trim()))
            return DisabledCodes.OVERWRITE;
        return DisabledCodes.NONE;
    };

    const onButtonClick = () => {
        setIsDialogVisible(true);
    };

    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            const name = props.editorName.trim();
            const missionSetSnapshot = combineMissionSets(
                props.combinedMissionNames,
                name,
                props.missionSetSnapshotCache,
            );
            saveSnapshotToLocalStorage(name, missionSetSnapshot);
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
