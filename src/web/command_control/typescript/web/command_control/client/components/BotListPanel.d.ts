import React = require("react");
import { PodStatus } from "./shared/PortalStatus";
interface Props {
    podStatus: PodStatus | null;
    selectedBotId: number | null;
    selectedHubId: number | null;
    trackedBotId: string | number | null;
    didClickBot: (bot_id: number) => void;
    didClickHub: (hub_id: number) => void;
}
export declare function BotListPanel(props: Props): React.JSX.Element;
export {};
