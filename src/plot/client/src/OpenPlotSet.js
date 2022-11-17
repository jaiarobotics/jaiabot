import React from "react"
import PlotProfiles from "./PlotProfiles";

// Dropdown menu showing all of the available logs to choose from
export class OpenPlotSet extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            plotSets: PlotProfiles.plot_profiles()
        }
    }

    render() {
        const plotSetItems = Object.keys(this.state.plotSets).map((name, index) => {
            const key = `${name}-${index}`

            const row = <div key={key} onClick={ this.didClickPlotSet.bind(this, name) } className="padded listItem">
                {name}
            </div>

            return row
        })

        console.log(plotSetItems)

        return (
          <div className="dialog">
            <div className="dialogHeader">Open Plot Set</div>

            <div className="section">
                <div className="list">{plotSetItems}</div>
            </div>

            <div className="buttonSection section">
                <button className="padded" onClick={this.cancelClicked.bind(this)}>Cancel</button>
            </div>
          </div>
        )
    }

    didClickPlotSet(name) {
        this.props.didSelectPlotSet?.(this.state.plotSets[name])
    }

    cancelClicked() {
        this.props.didSelectPlotSet?.(null)
    }

}

