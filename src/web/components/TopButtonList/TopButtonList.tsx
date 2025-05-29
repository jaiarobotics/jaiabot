import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";

import ActivateAllButton from "../ActivateAllButton/ActivateAllButton";

import { Button } from "@mui/material";
import StartAllMissionsButton from "../StartAllMissionsButton/StartAllMissionsButton";

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
            <Button className="jaia-button"></Button>
            <StartAllMissionsButton bots={jaiaContext.bots} missions={jaiaContext.missions} />
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
        </div>
    );
}
