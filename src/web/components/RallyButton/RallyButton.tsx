import { useState } from "react";
import { Button } from "@mui/material";
import rallyIcon from "../../style/icons/rally-point.svg";

/**
 * Produces the button that allows an operator to click on the map and
 * add a rally point
 */
export default function RallyButton() {
    const [isSelected, setIsSelected] = useState(false);

    const handleRallyButtonClick = () => {
        setIsSelected(!isSelected);
    };

    return (
        <div>
            <Button
                className={`jaia-button ${isSelected ? "selected" : ""}`}
                aria-label={"add-rally-point"}
                onClick={() => handleRallyButtonClick()}
            >
                <img src={rallyIcon} />
            </Button>
        </div>
    );
}
