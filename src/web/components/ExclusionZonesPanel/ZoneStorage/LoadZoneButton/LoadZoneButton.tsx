import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { loadSnapshotFromHub } from "../zone-storage";
import { DisabledCodes } from "./load-messages";
import { LoadZoneDialog } from "./LoadZoneDialog";

interface Props {
    saveName: string;
    savedNames: string[];
    onClose: () => void;
}

/**
 * Produces the load zone set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function LoadZoneButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
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
     * Displays dialog before loading the zone set.
     *
     * @returns {void}.
     */
    const onButtonClick = () => {
        setIsDialogVisible(true);
    };

    /**
     * Closes the dialog and dispatches events with the zone set snapshot.
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked.
     * @returns {void}.
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            loadSnapshotFromHub(props.saveName.trim()).then((snapshot) => {
                if (snapshot) {
                    jaiaDispatch({
                        type: JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
                        exclusionZoneSetName: props.saveName.trim(),
                    });
                    jaiaDispatch({
                        type: JaiaActions.RESTORE_EXCLUSION_ZONE_SNAPSHOT,
                        exclusionZoneSnapshot: snapshot,
                    });
                    props.onClose();
                }
            });
        }
    };

    return (
        <div>
            <button aria-label={"load-zone-set"} onClick={() => onButtonClick()}>
                Load
            </button>
            <LoadZoneDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                saveName={props.saveName}
                onClose={onDialogClose}
            />
        </div>
    );
}
