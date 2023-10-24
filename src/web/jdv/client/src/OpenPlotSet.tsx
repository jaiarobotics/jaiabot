import { mdiTrashCan } from "@mdi/js";
import React from "react"
import {Profile, ProfileLibrary, PlotProfiles} from "./PlotProfiles";
import Icon from "@mdi/react";

interface OpenPlotSetProps {
    didSelectPlotSet: (plotSet: Profile) => undefined
    didClose: () => void
}

interface OpenPlotSetState {
    plotSets: ProfileLibrary
}

// Dropdown menu showing all of the available logs to choose from
export class OpenPlotSet extends React.Component {

    props: OpenPlotSetProps
    state: OpenPlotSetState

    constructor(props: OpenPlotSet) {
        super(props)

        this.state = {
            plotSets: PlotProfiles.plot_profiles()
        }
    }

    render() {
        const plotSetItems = Object.keys(this.state.plotSets).map((name, index) => {
            const key = `${name}-${index}`

            const row = <div key={key} onClick={ this.didClickPlotSet.bind(this, name) } className="padded listItem horizontal flexbox">
                <div className="growable">
                    {name}
                </div>
                <button title="Delete" className="button" onClick={ this.didClickDeletePlotSet.bind(this, name) }>
                    <Icon path={mdiTrashCan} size={1} style={{verticalAlign: "middle"}}></Icon>
                </button>
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

    didClickDeletePlotSet(name: string, evt: Event) {
        PlotProfiles.delete_profile(name)
        this.setState({plotSets: PlotProfiles.plot_profiles()})
        evt.stopPropagation()
    }

    didClickPlotSet(name: string, evt: Event) {
        this.props.didSelectPlotSet?.(this.state.plotSets[name])
        this.props.didClose()
    }

    cancelClicked() {
        this.props.didClose()
    }

}

