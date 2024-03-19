import React from 'react';
import { JaiaAPI } from '../../common/JaiaAPI';
import { PortalBotStatus, PortalHubStatus } from './shared/PortalStatus';
interface Props {
    api: JaiaAPI;
    bots: {
        [key: number]: PortalBotStatus;
    };
    hubs: {
        [key: number]: PortalHubStatus;
    };
    getSelectedBotId: () => number;
    getFleetId: () => number;
    control: (onSuccess: () => void) => void;
}
interface State {
    bots: {
        [key: number]: PortalBotStatus;
    };
    hubs: {
        [key: number]: PortalHubStatus;
    };
}
export default class EngineeringPanel extends React.Component {
    props: Props;
    state: State;
    constructor(props: Props);
    static getDerivedStateFromProps(props: Props): {
        bots: {
            [key: number]: PortalBotStatus;
        };
        hubs: {
            [key: number]: PortalHubStatus;
        };
    };
    render(): React.JSX.Element;
}
export {};
