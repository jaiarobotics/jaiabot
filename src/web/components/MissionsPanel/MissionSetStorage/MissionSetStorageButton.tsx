import { useState } from "react";
import { MissionSetStorageDialog } from "./MissionSetStorageDialog";
import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiFolder } from "@mdi/js";

interface Props {
    missionSetName: string;
}

export default function MissionSetStorageButton(props: Props) {
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
            {isDialogVisible ? (
                <MissionSetStorageDialog
                    missionSetName={props.missionSetName}
                    onClose={onDialogClose}
                />
            ) : (
                <div></div>
            )}
        </div>
    );
}
