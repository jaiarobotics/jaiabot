import { useState } from "react";
import { missionSet } from "../../data/mission_set/mission-set";
import { MissionSetStorageDialog } from "./MissionSetStorageDialog";
import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiFolder } from "@mdi/js";

export default function MissionSetStorageButton() {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Closes the dialog box
     *
     * @returns {void}
     */
    const onDialogClose = async () => {
        setIsDialogVisible(false);
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"load-or-mission-set"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiFolder} title="Mission Set Storage"></Icon>
            </Button>
            <MissionSetStorageDialog isVisible={isDialogVisible} onClose={onDialogClose} />
        </div>
    );
}
