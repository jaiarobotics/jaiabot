import React, { ReactElement } from "react"

import {Log} from './Log'
import { LogApi } from "./LogApi"

function duration_string_from_seconds(duration_seconds: number) {
    var components = []

    if (duration_seconds >= 3600) {
        let hours = Math.floor(duration_seconds / 3600)
        components.push(`${hours} hr`)
        duration_seconds -= (hours * 3600)
    }

    if (duration_seconds >= 60) {
        let minutes = Math.floor(duration_seconds / 60)
        components.push(`${minutes} min`)
        duration_seconds -= (minutes * 60)
    }

    if (duration_seconds >= 1) {
        components.push(`${duration_seconds.toFixed(0)} sec`)
    }
    
    return components.join(', ')
}

function date_string_from_microseconds(timestamp_microseconds: number) {
    return new Date(timestamp_microseconds * 1e3).toLocaleString([], {
        dateStyle : 'medium',
        timeStyle : 'short',
    })
}

function save(key: string, value: string) {
    if (value != null) {
        localStorage.setItem(key, value)
    }
    else {
        localStorage.removeItem(key)
    }
}

type LogDict = {[key: string]: {[key: string]: {[key: string]: Log}}}

interface LogSelectorProps {
    didSelectLogs: (logs: string[]) => undefined
}

interface LogSelectorState {
    log_dict: LogDict
    fleet: string
    bot: string
    fromDate: string
    toDate: string
    selectedLogs: {[key: string]: Log}
}

// Dropdown menu showing all of the available logs to choose from
export default class LogSelector extends React.Component {

    props: LogSelectorProps
    state: LogSelectorState

    refreshTimer: NodeJS.Timeout

    constructor(props: LogSelectorProps) {
        super(props)

        this.state = {
            log_dict: {},
            fleet: localStorage.getItem("fleet"),
            bot: localStorage.getItem("bot"),
            fromDate: localStorage.getItem("fromDate"),
            toDate: localStorage.getItem("toDate"),
            selectedLogs: {}
        }

        this.refreshLogs()
    }

    render() {
        const self = this;

        const logs = this.getFilteredLogs()

        const logHeader = <div key="logHeader" className="logHeaderRow">
            <div className="fleetCell logHeader">
                Fleet
            </div>
            <div className="botCell logHeader">
                Bot
            </div>
            <div className="timeCell logHeader">
                Start time
            </div>
            <div className="durationCell logHeader">
                Duration
            </div>
        </div>

        const logItems = logs.map((log) => {
            const key = `${log.fleet}-${log.bot}-${log.timestamp}`
            const className = (log.filename in this.state.selectedLogs) ? "selected" : ""

            const row = <div key={key} onMouseDown={this.didToggleLog.bind(this, log)} onMouseEnter={(evt) => { if (evt.buttons) this.didToggleLog(log); }} className={"padded listItem " + className}>
                <div className="fleetCell">
                    {log.fleet}
                </div>
                <div className="botCell">
                    {log.bot}
                </div>
                <div className="timeCell">
                    {date_string_from_microseconds(log.timestamp)}
                </div>
                <div className="durationCell">
                    {duration_string_from_seconds(log.duration / 1e6)}
                </div>
            </div>

            return row
        })

        return (
          <div className="logSelector dialog">
            <div className="dialogHeader">Select Logs</div>
            <div className="section">
                <div className="dialogSectionHeader">Filters</div>
                

                <div className="horizontal flexbox equal" style={{justifyContent: "space-between", alignItems: "center"}}>

                    Fleet
                    <select name="fleet" id="fleet" className={"padded log"} onChange={this.did_select_fleet.bind(this)}  defaultValue={this.state.fleet}>
                    {this.fleet_option_elements()}
                    </select>

                    Bot
                    <select name="bot" id="bot" className={"padded log"} onChange={this.did_select_bot.bind(this)} defaultValue={this.state.bot}>
                    {this.bot_option_elements()}
                    </select>

                    From
                    <input type="date" id="fromDate" defaultValue={this.state.fromDate} onInput={this.fromDateChanged.bind(this)} />
                    To
                    <input type="date" id="toDate" defaultValue={this.state.toDate} onInput={this.toDateChanged.bind(this)} />
                
                </div>

            </div>

            <div className="section">
                {logHeader}
                <div className="list">{logItems}</div>
            </div>

            { this.buttonsElement() }
          </div>
        )
    }

    buttonsElement() {
        return <div className="buttonSection section">
            <button className="padded" onClick={this.deleteClicked.bind(this)}>Delete Logs</button>

            <button className="padded" onClick={this.cancelClicked.bind(this)}>Cancel</button>
            <button className="padded" onClick={this.okClicked.bind(this)}>Open Logs</button>
        </div>
    }

    componentDidMount(): void {
        this.refreshTimer = setInterval(this.refreshLogs.bind(this), 2000)
    }

    componentWillUnmount(): void {
        clearInterval(this.refreshTimer)
    }

    didToggleLog(log: Log) {
        var selectedLogs = this.state.selectedLogs

        if (log.filename in Object.keys(selectedLogs)) {
            delete selectedLogs[log.filename]
            this.setState({selectedLogs})
        }
        else {
            selectedLogs[log.filename] = log
            this.setState({selectedLogs})
        }
    }

    clearLogs() {
        this.setState({selectedLogs: {}})
    }

    getFilteredLogs(): Log[] {
        const { fromDate, toDate, log_dict } = this.state

        function stringToTimestamp(str: string) {
            if (str == null) return null
            const d = new Date(str)
            const t = d.getTime()
            if (isNaN(t)) return null
            else return t / 1e3
        }

        const from_timestamp = stringToTimestamp(this.state.fromDate)
        var to_timestamp = stringToTimestamp(this.state.toDate)

        if (to_timestamp != null) {
            to_timestamp = to_timestamp + 24 * 60 * 60
        }

        var log_array: Log[] = []

        for (const fleet in log_dict) {
            if (this.state.fleet != null && this.state.fleet != fleet) continue;

            const fleet_dict = log_dict[fleet]

            for (const bot in fleet_dict) {
                if (this.state.bot != null && this.state.bot != bot) continue;

                const bot_dict = fleet_dict[bot]

                for (const log of Object.values(bot_dict)) {
                    if (from_timestamp != null && log.timestamp < from_timestamp) continue;
                    if (to_timestamp != null && log.timestamp > to_timestamp) continue;

                    log_array.push(log)
                }
            }
        }

        log_array.sort((a, b) => {
            return b.timestamp - a.timestamp
        })

        return log_array
    }

    static log_dict(logs: Log[]) {
        var log_dict: LogDict = {}

        for (let log of logs) {
            if (!(log.fleet in log_dict)) {
                log_dict[log.fleet] = {}
            }

            if (!(log.bot in log_dict[log.fleet])) {
                log_dict[log.fleet][log.bot] = {}
            }

            if (!(log.timestamp in log_dict[log.fleet][log.bot])) {
                log_dict[log.fleet][log.bot][log.timestamp] = log
            }
        }

        return log_dict
    }

    dict_options(dict: {[key: string]: any}): ReactElement[] {
        let names = Object.keys(dict)
        names.sort()

        let first_option = <option key={"all"}>All</option>

        var elements = names.map(name => {
            return <option value={name} key={name}>{name}</option>
        })

        elements = [ first_option ].concat(elements)

        return elements
    }

    fleet_option_elements() {
        return this.dict_options(this.state.log_dict)
    }

    did_select_fleet(evt: Event) {
        var fleet = this.state.fleet
        let target = evt.target as HTMLSelectElement

        if (target.selectedIndex == 0) {
            fleet = null
        }
        else {
            fleet = target.value
        }
        this.setState({fleet})
        save("fleet", fleet)

        this.clearLogs()

    }

    bot_option_elements() {
        if (this.state.fleet == null) {
            return null
        }
        else {
            return this.dict_options(this.state.log_dict[this.state.fleet])
        }
    }

    did_select_bot(evt: Event) {
        var bot = this.state.bot
        let target = evt.target as HTMLSelectElement

        if (target.selectedIndex == 0) {
            bot = null
        }
        else {
            bot = target.value
        }
        this.setState({bot})
        save("bot", bot)

        this.clearLogs()
    }

    fromDateChanged(evt: Event) {
        let target = evt.target as HTMLSelectElement

        const fromDate = target.value
        this.setState({fromDate})
        save("fromDate", fromDate)
    }

    toDateChanged(evt: Event) {
        let target = evt.target as HTMLSelectElement

        const toDate = target.value
        this.setState({toDate})
        save("toDate", toDate)
    }

    cancelClicked() {
        this.props.didSelectLogs?.(null)
    }

    okClicked() {
        const selectedLogNames = Object.values(this.state.selectedLogs).map((log) => {
            return log.filename;
        })

        console.debug('Selected logs: ', selectedLogNames)
        this.props.didSelectLogs?.(selectedLogNames)
    }

    async deleteClicked() {
        const logNames = Object.values(this.state.selectedLogs).map(log => {
            const h5Name = log.filename.split('/').at(-1)
            const logName = h5Name.slice(0, h5Name.length - 3)
            return logName
        })

        const logNamesString = logNames.join('\n')

        if (confirm(`Are you sure you want to DELETE the logs named:\n${logNamesString}`)) {
            logNames.forEach(logName => {
                LogApi.delete_log(logName)
            })

            // Deselect all logs
            this.setState({selectedLogs: {}})
        }
    }

    refreshLogs() {
        LogApi.get_logs().then((logs) => {
            const log_dict = LogSelector.log_dict(logs)
            this.setState({log_dict})

            if (!(this.state.fleet in Object.keys(log_dict))) {
                this.setState({fleet: Object.keys(log_dict)[0]})
            }
        })
    }

}

