import React from 'react';
import { PanelType } from './CommandControl';
import '../style/components/SettingsPanel.css';
interface Props {
    taskPacketsTimeline: {
        [key: string]: string | boolean;
    };
    isClusterModeOn: boolean;
    handleTaskPacketEditDatesToggle: () => void;
    handleTaskPacketsTimelineChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmitTaskPacketsTimeline: () => void;
    handleKeepEndDateCurrentToggle: () => void;
    isTaskPacketsSendBtnDisabled: () => boolean;
    setClusterModeStatus: (isOn: boolean) => void;
    setVisiblePanel: (panelType: PanelType) => void;
    trackBot: (id: number | string) => void;
    trackingTarget: string | number | null;
    visiblePanel: PanelType;
    zoomToPod: (firstMove: boolean) => void;
}
export declare function SettingsPanel(props: Props): React.JSX.Element;
export {};
