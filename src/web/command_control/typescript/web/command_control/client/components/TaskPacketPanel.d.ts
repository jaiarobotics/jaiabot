import React from 'react';
import { PanelType } from './CommandControl';
import '../style/components/TaskPacketPanel.css';
interface Props {
    type: string;
    taskPacketData: {
        [key: string]: {
            [key: string]: string;
        };
    };
    setVisiblePanel: (panelType: PanelType) => void;
}
export declare function TaskPacketPanel(props: Props): React.JSX.Element;
export {};
