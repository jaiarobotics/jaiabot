import { useContext } from "react";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { UNASSIGNED_ID } from "../../../utils/constants";

interface Props {
    zoneID: number;
}

export default function ZoneAssignMenu(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const currentBotID = jaiaContext.exclusionZoneSet.getAssignment(props.zoneID);

    const handleMenuSelection = (evt: SelectChangeEvent) => {
        jaiaDispatch({
            type: JaiaActions.ASSIGN_EXCLUSION_ZONE,
            zoneID: props.zoneID,
            botID: Number(evt.target.value),
        });
    };

    return (
        <FormControl sx={{ width: 135 }} size="small">
            <InputLabel>Bot</InputLabel>
            <Select label="Bot" onChange={handleMenuSelection} value={currentBotID.toString()}>
                <MenuItem value={UNASSIGNED_ID}>All Bots</MenuItem>
                {Array.from(jaiaContext.bots.getBots().values()).map((bot) => (
                    <MenuItem key={bot.getBotID()} value={bot.getBotID()}>
                        {`Bot-${bot.getBotID()}`}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
