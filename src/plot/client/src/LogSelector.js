import React from "react"

function duration_string_from_seconds(duration_seconds) {
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

// Dropdown menu showing all of the available logs to choose from
export default class LogSelector extends React.Component {

  constructor(props) {
    super(props)

        this.state = {
      log_dict : {},
      fleet : null,
      bot : null,
      timestamp : null
    }
  }

  render() {
    return (
        <div>Fleet<select name = "fleet" id = "fleet" className =
                       {"padded log"} onChange = {this.did_select_fleet.bind(
                           this)}>{this.fleet_option_elements()}<
            /select>
            Bot
            <select name="bot" id="bot" className={"padded log"} onChange={this.did_select_bot.bind(this)}>
              {this.bot_option_elements()}
            </select>
            Time<select name = "timestamp" id = "timestamp" className =
                     {"padded time"} onChange = {this.props.log_was_selected}>{
                this.timestamp_option_elements()}</select>
          </div>)
  }

  static getDerivedStateFromProps(props) {
    let log_dict = LogSelector.log_dict(props.logs)
    var state = {
      log_dict : log_dict
    }

    if (Object.keys(log_dict).length == 1) {
      state.fleet = Object.keys(log_dict)[0]
    }

    return state
  }

  static log_dict(logs) {
    var log_dict = {}

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

  dict_options(dict) {
    let names = Object.keys(dict)
    names.sort()

    let first_option = <option key = {"select bot"}>Select<
        /option>

        var elements = names.map(name => {
            return <option value={name} key={name}>{name}</option>
  })

  if(elements.length > 1) {
    elements = [ first_option ].concat(elements)
  }

  return elements
}

fleet_option_elements() { return this.dict_options(this.state.log_dict) }

did_select_fleet(evt) { this.setState({fleet : evt.target.value}) }

bot_option_elements() {
  if (this.state.fleet == null) {
    return null
  } else {
    return this.dict_options(this.state.log_dict[this.state.fleet])
  }
}

did_select_bot(evt) { this.setState({bot : evt.target.value}) }

timestamp_option_elements() {
  if (this.state.fleet == null || this.state.bot == null) {
    return null
  } else {
    let dict =
        this.state.log_dict[this.state.fleet][this.state.bot] var timestamps =
            Object.keys(dict)
    timestamps.sort()
    timestamps.reverse()

            var option_elements = [<option key={"select time"}>Select</option>]

            for (let timestamp of timestamps) {
                let log = dict[timestamp]

                let date_string = new Date(log.timestamp * 1e3).toLocaleString([], {
                    dateStyle : 'medium',
                    timeStyle : 'short',
                })

                let duration_string = "[ " + duration_string_from_seconds(log.duration / 1e6) + " ]"
            
                option_elements.push(<option value={log.filename} key={log.filename}>{date_string} {duration_string}</option>)
  }

  return option_elements
}
}
}
