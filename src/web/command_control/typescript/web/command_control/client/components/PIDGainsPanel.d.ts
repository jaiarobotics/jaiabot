import React from 'react';
import { JaiaAPI } from '../../common/JaiaAPI';
import { PortalBotStatus } from './shared/PortalStatus';
interface Props {
    api: JaiaAPI;
    bots: {
        [key: number]: PortalBotStatus;
    };
    control: (onSuccess: () => void) => void;
}
interface State {
    bots: {
        [key: number]: PortalBotStatus;
    };
}
export declare class PIDGainsPanel extends React.Component {
    botId: number | null;
    props: Props;
    state: State;
    constructor(props: Props);
    static getDerivedStateFromProps(props: Props): {
        bots: {
            [key: number]: PortalBotStatus;
        };
    };
    render(): React.JSX.Element;
    didSelectBot(evt: Event): void;
    queryEngineeringStatus(): void;
    queryAllEngineeringStatus(): void;
    submitGains(): void;
    submitBotRequirements(): void;
    submitAllBotRequirements(): void;
}
export {};
