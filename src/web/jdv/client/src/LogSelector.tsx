import React, { ReactElement } from "react"

import {Log} from './Log'
import { LogApi } from "./LogApi"
import { CustomAlert } from "./shared/CustomAlert"

function getNavigatorLanguage() {
    return navigator.languages?.[0] ?? navigator.language ?? 'en'
}

const sizeFormatter = Intl.NumberFormat(getNavigatorLanguage(), {minimumFractionDigits: 1, maximumFractionDigits: 1})

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

interface LogSelectorDelegate {
    didSelectLogs: (logs: string[]) => void
}

interface LogSelectorProps {
    delegate: LogSelectorDelegate
}

interface LogSelectorState {
    log_dict: LogDict
    fleetFilter: string
    botFilter: string
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
            fleetFilter: localStorage.getItem("fleetFilter"),
            botFilter: localStorage.getItem("botFilter"),
            fromDate: localStorage.getItem("fromDate"),
            toDate: localStorage.getItem("toDate"),
            selectedLogs: {}
        }

        this.refreshLogs()
    }

    setFleetFilter(fleetFilter: string) {
        this.setState({fleetFilter: fleetFilter, botFilter: null, selectedLogs: {}})
        save('fleetFilter', fleetFilter)
        this.setBotFilter(null)
    }

    setBotFilter(botFilter: string) {
        this.setState({botFilter, selectedLogs: {}})
        save('botFilter', botFilter)
    }

    render() {
        const self = this;

        const logs = this.getFilteredLogs()

        const logHeader = <div key="logHeader" className="logHeaderRow">
            <div className="smallCell logHeader">
                Fleet
            </div>
            <div className="smallCell logHeader">
                Bot
            </div>
            <div className="bigCell logHeader">
                Start time
            </div>
            <div className="bigCell logHeader">
                Duration
            </div>
            <div className="bigCell logHeader rightJustify">
                Size (bytes)
            </div>
        </div>

        const logItems = logs.map((log) => { return this.logRowElement(log) })

        return (
          <div className="logSelector dialog">
            <div className="dialogHeader">Select Logs</div>
            <div className="section">
                <div className="dialogSectionHeader">Filters</div>
                

                <div className="horizontal flexbox equal" style={{justifyContent: "space-between", alignItems: "center"}}>

                    Fleet
                    <select name="fleet" id="fleet" className={"padded log"} onChange={this.did_select_fleet.bind(this)} value={this.state.fleetFilter ?? undefined}>
                    {this.fleet_option_elements()}
                    </select>

                    Bot
                    <select name="bot" id="bot" className={"padded log"} onChange={this.did_select_bot.bind(this)} value={this.state.botFilter ?? undefined}>
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

    logRowElement(log: Log) {
        const key = `${log.fleet}-${log.bot}-${log.timestamp}`
        const className = (log.filename in this.state.selectedLogs) ? "selected" : ""

        let sizeString = '?'
        if (log.size != null) {
            sizeString = sizeFormatter.format(log.size / 1_000_000) + ' MB'
        }

        const row = <div key={key} onMouseDown={this.didToggleLog.bind(this, log)} onMouseEnter={(evt) => { if (evt.buttons) this.didToggleLog(log); }} className={"padded listItem " + className}>
            <div className="smallCell">
                {log.fleet}
            </div>
            <div className="smallCell">
                {log.bot}
            </div>
            <div className="bigCell">
                {date_string_from_microseconds(log.timestamp)}
            </div>
            <div className="bigCell">
                {log.duration ? duration_string_from_seconds(log.duration / 1e6) : "Unconverted"}
            </div>
            <div className="bigCell rightJustify">
                {sizeString}
            </div>
        </div>

        return row
    }

    buttonsElement() {
        return <div className="buttonSection section">
            <button className="danger padded" onClick={this.deleteClicked.bind(this)}>Delete Logs</button>
            <div className="spacer"></div>
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

        if (log.filename in selectedLogs) {
            delete selectedLogs[log.filename]
            this.setState({selectedLogs})
        }
        else {
            selectedLogs[log.filename] = log
            this.setState({selectedLogs})
        }
    }

    clearSelectedLogs() {
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
            if (this.state.fleetFilter != null && this.state.fleetFilter != fleet) continue;

            const fleet_dict = log_dict[fleet]

            for (const bot in fleet_dict) {
                if (this.state.botFilter != null && this.state.botFilter != bot) continue;

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

    /**
     * Returns <option> elements for "All" plus one for each key in the dict.
     * @param dict A JS object with keys corresponding to each <option> element
     * @returns The array of <option> elements
     */
    dict_options(dict: {[key: string]: any}): ReactElement[] {
        let first_option = <option key="all">All</option>

        if (!dict) {
            return [ first_option ]            
        }

        let names = Object.keys(dict)
        names.sort()

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
        let target = evt.target as HTMLSelectElement
        const fleetFilter = (target.selectedIndex != 0) ? target.value : null
        this.setFleetFilter(fleetFilter)
    }

    bot_option_elements() {
        if (this.state.fleetFilter == null) {
            return null
        }
        else {
            return this.dict_options(this.state.log_dict[this.state.fleetFilter])
        }
    }

    did_select_bot(evt: Event) {
        let target = evt.target as HTMLSelectElement
        const botFilter = target.selectedIndex == 0 ? null : target.value
        this.setBotFilter(botFilter)
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
        this.props.delegate.didSelectLogs(null)
    }

    okClicked() {
        const selectedLogNames = Object.values(this.state.selectedLogs).map((log) => {
            return log.filename;
        })

        console.debug('Selected logs: ', selectedLogNames)
        this.props.delegate.didSelectLogs(selectedLogNames)
    }

    async deleteClicked() {
        const logNames = Object.values(this.state.selectedLogs).map(log => {
            return log.filename
        })

        const logNamesString = logNames.join('\n')

        if (await CustomAlert.confirmAsync(`Are you sure you want to DELETE the logs named:\n${logNamesString}`, 'Delete Logs')) {
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

            if (this.state.fleetFilter && log_dict[this.state.fleetFilter] == null) {
                this.setFleetFilter(null)
            }
        })
    }

}

