import CircularProgress from "@mui/material/CircularProgress";
import { useContext } from "react";
import { JaiaContext } from "../../../context/JaiaContext";
import "./DataOffloadQueue.less";
import { UNASSIGNED_ID } from "../../../utils/constants";

interface Props {
    botID: number;
    offloadPercentage: number;
}

/**
 * Displays which Bots will offload data and the progress
 */
export default function DataOffloadQueue() {
    const jaiaContext = useContext(JaiaContext);
    if (jaiaContext === null) {
        return;
    }

    // Whichever Hub the Bot is offloading to, not necessarily the lowest numbered one
    const queueItems = [];
    for (const hub of jaiaContext.hubs.getHubs().values()) {
        const botOffload = hub.getBotOffload();
        if (!botOffload || botOffload.bot_id === UNASSIGNED_ID) {
            continue;
        }

        queueItems.push(
            <QueueItem
                botID={botOffload.bot_id}
                offloadPercentage={botOffload.data_offload_percentage}
                key={`${hub.getHubID()}-${botOffload.bot_id}`}
            />,
        );

        for (const botID of botOffload.bots_pending ?? []) {
            queueItems.push(
                <QueueItem
                    botID={botID}
                    offloadPercentage={0}
                    key={`${hub.getHubID()}-${botID}`}
                />,
            );
        }
    }

    return <div className="data-offload-queue">{queueItems}</div>;
}

/**
 * Creates structure for Bots in the process of or awaiting a data offload
 */
function QueueItem(props: Props) {
    if (props.offloadPercentage === 100) {
        return;
    }

    return (
        <div className="queue-item">
            <div>Bot {props.botID}</div>
            <CircularProgress variant="determinate" value={props.offloadPercentage} color="error" />
        </div>
    );
}
