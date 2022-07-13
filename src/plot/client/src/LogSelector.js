import React from "react"

// Dropdown menu showing all of the available logs to choose from
export default function LogSelector(props) {
    var option_elements = []
  
    for (let log of props.logs) {
      let date_string = new Date(log.timestamp * 1e3).toLocaleString([], {
        dateStyle : 'medium',
        timeStyle : 'short',
      })
  
      option_elements.push(<option value={log.filename} key={log.filename}>{log.filename + '  time: ' + date_string}</option>)
    }
  
    return (
      <div>
        <label className="label padded">Log</label>
        <select name="log" id="log" onChange={props.log_was_selected}>
          {option_elements}
        </select>
      </div>
    )
  }

