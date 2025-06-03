import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";

import ActivateAllButton from "../ActivateAllButton/ActivateAllButton";
import StopAllBotsButton from "../StopAllBots/StopAllBotsButton";
import StartAllMissionsButton from "../StartAllMissionsButton/StartAllMissionsButton";

import { Button } from "@mui/material";

/**
 * Displays the buttons located at the top of the JCC
 */
export default function TopButtonList() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDisaptch = useContext(JaiaDispatchContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    return (
        <div className="button-list top">
            <ActivateAllButton bots={jaiaContext.bots} />
            <StopAllBotsButton bots={jaiaContext.bots} />
            <StartAllMissionsButton bots={jaiaContext.bots} missions={jaiaContext.missions} />
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
        </div>
    );
}
