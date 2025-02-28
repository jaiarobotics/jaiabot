import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../context/Jaia/jaia-actions";
import { PanelNames } from "../../types/context-types";

import Icon from "@mdi/react";
import { Button } from "@mui/material";
import { mdiViewList } from "@mdi/js";

export default function SideButtonList() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDisaptch = useContext(JaiaDispatchContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    const handlePanelButtonClick = (panelName: PanelNames) => {
        jaiaDisaptch({ type: JaiaActions.CLICKED_PANEL_BUTTON, panelName: panelName });
    };

    const getSelectedClassName = (panelName: PanelNames) => {
        if (jaiaContext.visiblePanel === panelName) {
            return "selected";
        }
        return "";
    };

    return (
        <div className="button-list side">
            <Button
                className={`jaia-button ${getSelectedClassName(PanelNames.MISSIONS)}`}
                onClick={() => handlePanelButtonClick(PanelNames.MISSIONS)}
            >
                <Icon path={mdiViewList} title="Missions Panel" />
            </Button>

            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
        </div>
    );
}
