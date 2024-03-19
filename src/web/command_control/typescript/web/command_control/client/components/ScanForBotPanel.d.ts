import React from 'react';
import { JaiaAPI } from '../../common/JaiaAPI';
import { PortalHubStatus } from './shared/PortalStatus';
interface Props {
    hubs: {
        [key: number]: PortalHubStatus;
    };
    api: JaiaAPI;
    control: (onSuccess: () => void) => void;
}
export default class ScanForBotPanel extends React.Component {
    props: Props;
    constructor(props: Props);
    render(): React.JSX.Element;
    submitScanForBot(): void;
    submitScanForAllBots(): void;
}
export {};
