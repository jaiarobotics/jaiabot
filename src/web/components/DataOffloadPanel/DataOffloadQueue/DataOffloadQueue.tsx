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

    const hub = jaiaContext.hubs.getHubs().values().next()?.value;
    if (!hub) {
        return;
    }

    /**
     * Creates a QueueItem component for each Bot pending a data offload
     *
     * @returns {QueueItem[]} QueueItem elements for Bots pending data offload
     */
    const renderBotsPending = () => {
        const botsPending: number[] = hub.getBotOffload().bots_pending;
        if (botsPending) {
            return botsPending.map((botID) => (
                <QueueItem botID={botID} offloadPercentage={0} key={botID} />
            ));
        }
        return;
    };

    const botOffload = hub.getBotOffload();
    if (botOffload && botOffload.bot_id !== UNASSIGNED_ID) {
        return (
            <div className="data-offload-queue">
                <QueueItem
                    botID={botOffload.bot_id}
                    offloadPercentage={botOffload.data_offload_percentage}
                    key={botOffload.bot_id}
                />
                {renderBotsPending()}
            </div>
        );
    }

    return <div className="data-offload-queue"></div>;
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
