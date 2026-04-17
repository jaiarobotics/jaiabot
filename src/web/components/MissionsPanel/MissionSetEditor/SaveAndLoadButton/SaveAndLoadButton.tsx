import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { listSavedMissionSets } from "../../MissionSetStorage/mission-set-storage";
import { saveSnapshotToLocalStorage } from "../../MissionSetStorage/mission-set-storage";
import { combineMissionSets } from "../mission-set-editor";
import { DisabledCodes } from "./save-and-load-messages";
import { SaveAndLoadDialog } from "./SaveAndLoadDialog";

interface Props {
    editorName: string;
    desiredMissionCount: number;
    leftList: string[];
    onClose: () => void;
}

export default function SaveAndLoadButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext) as ((action: unknown) => void) | null;
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    const getDisabledCode = (): DisabledCodes => {
        if (!props.editorName.trim()) return DisabledCodes.NO_NAME;
        if (props.leftList.length < 2) return DisabledCodes.NO_MISSIONS;
        if (!props.desiredMissionCount || props.desiredMissionCount < 1)
            return DisabledCodes.NO_MISSION_COUNT;
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
            const snapshot = combineMissionSets(props.leftList, props.desiredMissionCount, name);
            saveSnapshotToLocalStorage(name, snapshot);
            if (jaiaDispatch) {
                jaiaDispatch({
                    type: JaiaActions.LOAD_MISSION_SET,
                    missionSetSnapshot: snapshot,
                });
            }
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
