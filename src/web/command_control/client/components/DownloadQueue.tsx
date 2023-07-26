import React from 'react'
import CircularProgress from '@mui/joy/CircularProgress';
import Icon from '@mdi/react'
import { mdiClose } from '@mdi/js'
import '../style/components/DownloadQueue.css'
import { PortalBotStatus } from './shared/PortalStatus';

interface Props {
    downloadableBots: PortalBotStatus[]
    removeBotFromQueue: (bot: PortalBotStatus) => void
}

export default function DownloadQueue(props: Props) {
    return (
        <div className="download-queue-outer-container">
			<div className="panel-heading">Download Queue</div>
            <div className="download-queue-inner-container">
                {props.downloadableBots.map(bot => {
                    return (
                        <div className="download-queue-card">
                            <div className="download-queue-bot-number">Bot: {bot.bot_id}</div>
                            <CircularProgress determinate value={bot.data_offload_percentage ? bot.data_offload_percentage : 0}/>
                            <div className='download-queue-clos-btn-container' onClick={() => props.removeBotFromQueue(bot)}>
                                <Icon path={mdiClose} size={1} className='download-queue-close-btn'/>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}