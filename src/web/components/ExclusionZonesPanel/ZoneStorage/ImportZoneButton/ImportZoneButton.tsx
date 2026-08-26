import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { importZonesFromFile, ImportZoneResultType } from "../zone-storage";
import { ImportZoneDialog, DialogWarningType } from "./ImportZoneDialog";

interface Props {
    onClose: () => void;
}

/**
 * Produces the import zone set button.
 * It manages the alert/confirm dialog that displays warnings to the user.
 */
export default function ImportZoneButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [dialogWarningType, setDialogWarningType] = useState<DialogWarningType>(
        DialogWarningType.CLEAR_ZONES,
    );

    /**
     * Displays initial warning dialog before importing the zone set.
     *
     * @returns {void}.
     */
    const onButtonClick = () => {
        setDialogWarningType(DialogWarningType.CLEAR_ZONES);
        setIsDialogVisible(true);
    };

    /**
     * Dispatches an event with the zone set snapshot if the user confirms they want
     * to import and the file can be parsed. Re-opens the dialog with a warning if
     * the file format is invalid.
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked.
     * @returns {void}.
     */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            const result = await importZonesFromFile();
            if (result.resultType === ImportZoneResultType.SUCCESS && result.snapshot) {
                jaiaDispatch({
                    type: JaiaActions.RESTORE_EXCLUSION_ZONE_SNAPSHOT,
                    exclusionZoneSnapshot: result.snapshot,
                });
                props.onClose();
            } else if (result.resultType === ImportZoneResultType.INVALID_FORMAT) {
                setDialogWarningType(DialogWarningType.INVALID_FORMAT);
                setIsDialogVisible(true);
            }
            // CANCELLED: user closed the file picker, do nothing
        }
    };

    return (
        <div>
            <button aria-label={"import-zone-set"} onClick={() => onButtonClick()}>
                Import
            </button>
            <ImportZoneDialog
                isVisible={isDialogVisible}
                warningType={dialogWarningType}
                onClose={onDialogClose}
            />
        </div>
    );
}
