import React, { useEffect } from "react";
const Plotly = require('plotly.js-dist')
import { JDVPowerDensitySpectrumData } from "./JDVTypes";
import { JDVTitleBar } from "./JDVTitleBar";
import "./PowerDensitySpectrumWindow.css"


interface Props {
    powerDensitySpectrumData: JDVPowerDensitySpectrumData,
    onClose: () => void
}


export function PowerDensitySpectrumWindow(props: Props) {
    useEffect(() => {
        const text: string[] = []

        for (var index = 0; index < props.powerDensitySpectrumData.frequency.length; index++) {
            const frequency = props.powerDensitySpectrumData.frequency[index]
            const period = 1.0 / frequency
            const powerDensity = props.powerDensitySpectrumData.powerDensity[index]
            const pointText = `Frequency: ${frequency.toFixed(4)} Hz<br />` +
                `Period: ${period.toFixed(2)} seconds<br />` +
                `Power density: ${powerDensity.toFixed(3)} m^2/Hz`
            text.push(pointText)
        }

        const trace = {
            x: props.powerDensitySpectrumData.frequency,
            y: props.powerDensitySpectrumData.powerDensity,
            text: text
        }

        const layout = {
            title: 'Power Density Spectrum',
            xaxis: {
                title: 'Frequency (Hz)'
            },
            yaxis: {
                title: 'Power Density (m^2/Hz)'
            }
        }
          
        Plotly.newPlot('powerDensitySpectrumDiv', [trace], layout, {responsive: true});
    }, [])

    return <div className="PowerDensitySpectrumWindow dialog">
        <JDVTitleBar onClose={props.onClose}></JDVTitleBar>
        <div id="powerDensitySpectrumDiv" className="powerDensitySpectrumDiv"></div>
    </div>
}
