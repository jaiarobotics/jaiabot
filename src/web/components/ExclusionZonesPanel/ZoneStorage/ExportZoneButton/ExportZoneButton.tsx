import { useContext, useState } from "react";
import { JaiaContext } from "../../../../context/JaiaContext";
import { DialogActions } from "../../../../types/context-types";
import { exportZonesToFile } from "../zone-storage";
import { DisabledCodes } from "./export-messages";
import { ExportZoneDialog } from "./ExportZoneDialog";

interface Props {
    saveName: string;
}

/**
 * Produces the export zone set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function ExportZoneButton(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Checks the zone set and applies the appropriate disabled code.
     *
     * @returns {DisabledCodes} The applicable disabled code based on the zone set conditions.
     */
    const getDisabledCode = () => {
        if (jaiaContext?.obstacleAvoidanceData.getExclusionZoneSet().getZones().size === 0)
            return DisabledCodes.NO_ZONES;
        if (!props.saveName.trim()) return DisabledCodes.NO_NAME;
        return DisabledCodes.NONE;
    };

    /**
     * Displays dialog if a warning condition exists or exports the zone set directly.
     *
     * @returns {void}.
     */
    const onButtonClick = () => {
        if (getDisabledCode() !== DisabledCodes.NONE) {
            setIsDialogVisible(true);
        } else {
            onDialogClose(DialogActions.CONFIRMED);
        }
    };

    /**
     * Closes the dialog box then acts based on the button clicked.
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked.
     * @returns {void}.
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            exportZonesToFile(props.saveName.trim());
        }
    };

    return (
        <div>
            <button aria-label={"export-zone-set"} onClick={() => onButtonClick()}>
                Export
            </button>
            <ExportZoneDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}
