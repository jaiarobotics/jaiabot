import React from 'react';
import { SelectChangeEvent } from '@mui/material/Select';
import { RunInterface } from '../CommandControl';
import '../../style/components/RunItem.less';
type RunItemProps = {
    botIds: number[];
    botsNotAssignedToRuns: number[];
    runIdInEditMode: string;
    run: RunInterface;
    openRunPanels: {
        [runId: string]: boolean;
    };
    setOpenRunPanels: (runPanels: {
        [runId: string]: boolean;
    }) => void;
    handleBotAssignChange: (prevBotId: number, newBotId: number, runId: string) => void;
    unSelectHubOrBot: () => void;
    addDuplicateRun: (run: RunInterface) => void;
    deleteSingleRun: (runId: string) => void;
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean;
    toggleShowTableOfWaypoints: (runId: string) => void;
};
type RunItemState = {};
export default class RunItem extends React.Component<RunItemProps, RunItemState> {
    nonActiveRunStates: string[];
    isWptToggled(): boolean;
    toggleWpt(): void;
    makeAccordionTheme(): import("@mui/material").Theme;
    componentDidMount(): void;
    handleBotSelectionChange(event: SelectChangeEvent): void;
    isRunPanelOpen(): boolean;
    handleOpenCloseClick(): void;
    handleDuplicateRunClick(): void;
    getBotName(): string;
    render(): React.JSX.Element;
}
export {};
