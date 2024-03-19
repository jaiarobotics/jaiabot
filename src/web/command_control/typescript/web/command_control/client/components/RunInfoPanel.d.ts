import React from 'react';
import { PanelType } from './CommandControl';
import '../style/components/RunInfoPanel.css';
interface Props {
    setVisiblePanel: (panelType: PanelType) => void;
    runNum: number;
    botId: number;
    deleteRun: (runId: string) => void;
}
export default function RunInfoPanel(props: Props): React.JSX.Element;
export {};
