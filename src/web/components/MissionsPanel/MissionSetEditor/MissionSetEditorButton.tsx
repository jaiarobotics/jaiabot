import { useState } from "react";
import { Button } from "@mui/material";
import Icon from "@mdi/react";
import { mdiSetMerge } from "@mdi/js";

import { MDI_BUTTON_SIZE } from "../../../utils/constants";
import { MissionSetEditorDialog } from "./MissionSetEditorDialog";

/**
 * Toolbar button that opens the Mission Set Editor dialog.
 */
export default function MissionSetEditorButton() {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    return (
        <div>
            <Button
                className="jaia-button"
                aria-label="mission-set-editor"
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiSetMerge} size={MDI_BUTTON_SIZE} title="Mission Set Editor" />
            </Button>
            <MissionSetEditorDialog
                isVisible={isDialogVisible}
                onClose={() => setIsDialogVisible(false)}
            />
        </div>
    );
}
