import React from 'react';
import '../style/components/DownloadPanel.css';
import '../style/components/Details.less';
import { PortalBotStatus } from './shared/PortalStatus';
interface Props {
    downloadableBots: PortalBotStatus[];
    removeBotFromQueue: (bot: PortalBotStatus) => void;
    getBotDownloadPercent: (botId: number) => number;
    processDownloadAllBots: () => Promise<void>;
}
export default function DownloadPanel(props: Props): React.JSX.Element;
export {};
