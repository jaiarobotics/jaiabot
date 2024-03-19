import React from 'react';
import { RunInterface } from '../CommandControl';
import { SelectChangeEvent } from '@mui/material/Select';
interface Props {
    handleBotSelectionChange: (evt: SelectChangeEvent) => void;
    run: RunInterface;
    botsNotAssigned: number[];
}
export default function RunAssignMenu(props: Props): React.JSX.Element;
export {};
