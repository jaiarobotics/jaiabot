import React from 'react';
import { JaiaAPI } from '../../common/JaiaAPI';
import { MissionInterface, RunInterface } from './CommandControl';
import { PortalHubStatus, PortalBotStatus } from './shared/PortalStatus';
import '../style/components/Details.less';
export interface DetailsExpandedState {
    quickLook: boolean;
    commands: boolean;
    advancedCommands: boolean;
    health: boolean;
    data: boolean;
    gps: boolean;
    imu: boolean;
    sensor: boolean;
    power: boolean;
    links: boolean;
}
export interface BotDetailsProps {
    bot: PortalBotStatus;
    hub: PortalHubStatus;
    api: JaiaAPI;
    mission: MissionInterface;
    run: RunInterface;
    isExpanded: DetailsExpandedState;
    downloadQueue: PortalBotStatus[];
    closeWindow: () => void;
    takeControl: (onSuccess: () => void) => void;
    deleteSingleMission: (runId: string, disableMessage?: string) => void;
    setDetailsExpanded: (section: keyof DetailsExpandedState, expanded: boolean) => void;
    isRCModeActive: (botId: number) => boolean;
    setRcMode: (botId: number, rcMode: boolean) => void;
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean;
    downloadIndividualBot: (bot: PortalBotStatus, disableMessage: string) => void;
}
export declare function BotDetailsComponent(props: BotDetailsProps): React.JSX.Element;
export interface HubDetailsProps {
    hub: PortalHubStatus;
    api: JaiaAPI;
    isExpanded: DetailsExpandedState;
    setDetailsExpanded: (section: keyof DetailsExpandedState, expanded: boolean) => void;
    getFleetId: () => number;
    closeWindow: () => void;
    takeControl: (onSuccess: () => void) => void;
}
export declare function HubDetailsComponent(props: HubDetailsProps): React.JSX.Element;
