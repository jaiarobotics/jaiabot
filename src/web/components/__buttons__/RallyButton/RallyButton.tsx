import { useContext } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { MapModes } from "../../../types/openlayers-types";
import { ButtonNames, ButtonTypes } from "../../../types/context-types";
import { info } from "../../../utils/notifications";

import { Button } from "@mui/material";
import rallyIcon from "../../../style/icons/rally-point.svg";

/**
 * Produces the button that allows an operator to click on the map and
 * add a rally point
 */
export default function RallyButton() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Provides the base Jaia button class name and toggles the selected name
     * to update the button color
     *
     * @returns {string} Class name that applies the correct style
     */
    const getClassName = () => {
        return `jaia-button ${jaiaContext.jaiaGlobal.getMapMode() === MapModes.RALLY ? "selected" : ""}`;
    };

    /**
     * Dispatches the action to toggle rally mode on the map
     *
     * @returns {void}
     */
    const handleRallyButtonClick = () => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: ButtonTypes.MAP_MODE,
            buttonName: ButtonNames.ADD_RALLY,
        });
        info("Tap to add rally point");
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"add-rally-point"}
                onClick={() => handleRallyButtonClick()}
            >
                <img src={rallyIcon} />
            </Button>
        </div>
    );
}
