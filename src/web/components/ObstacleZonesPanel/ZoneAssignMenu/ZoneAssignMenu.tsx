import { useContext } from "react";

import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { UNASSIGNED_ID } from "../../../utils/constants";

interface Props {
    zoneID: number;
}

const ALL_BOTS_VALUE = String(UNASSIGNED_ID);

export default function ZoneAssignMenu(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const currentBotIDs = jaiaContext.exclusionZoneSet.getAssignment(props.zoneID); // number[]
    const currentStrings = currentBotIDs.map(String);
    const isAllBots = currentBotIDs.includes(UNASSIGNED_ID);

    const handleMenuSelection = (evt: SelectChangeEvent) => {
        const raw = evt.target.value as unknown as string[];

        let nextStrings: string[];
        const hadAllBots = currentStrings.includes(ALL_BOTS_VALUE);
        const nowHasAllBots = raw.includes(ALL_BOTS_VALUE);

        if (!hadAllBots && nowHasAllBots) {
            // "All Bots" was just picked → collapse to all-bots only
            nextStrings = [ALL_BOTS_VALUE];
        } else if (hadAllBots && nowHasAllBots && raw.length > 1) {
            // Had all-bots, user picked a specific bot → switch to specific bots only
            nextStrings = raw.filter((v) => v !== ALL_BOTS_VALUE);
        } else {
            nextStrings = raw;
        }

        if (nextStrings.length === 0) nextStrings = [ALL_BOTS_VALUE];

        jaiaDispatch({
            type: JaiaActions.ASSIGN_EXCLUSION_ZONE,
            zoneID: props.zoneID,
            botIDs: nextStrings.map(Number),
        });
    };

    const renderValue = (selected: unknown) => {
        const arr = selected as string[];
        if (arr.includes(ALL_BOTS_VALUE)) return "All Bots";
        return arr.map((s) => `Bot-${s}`).join(", ");
    };

    return (
        <FormControl sx={{ width: 160 }} size="small">
            <InputLabel>Bots</InputLabel>
            <Select
                multiple
                label="Bots"
                value={currentStrings as unknown as string}
                onChange={handleMenuSelection}
                input={<OutlinedInput label="Bots" />}
                renderValue={renderValue}
            >
                <MenuItem value={ALL_BOTS_VALUE}>
                    <Checkbox checked={isAllBots} />
                    <ListItemText primary="All Bots" />
                </MenuItem>
                {Array.from(jaiaContext.bots.getBots().values()).map((bot) => (
                    <MenuItem key={bot.getBotID()} value={String(bot.getBotID())}>
                        <Checkbox checked={!isAllBots && currentBotIDs.includes(bot.getBotID())} />
                        <ListItemText primary={`Bot-${bot.getBotID()}`} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
