import React from 'react'


const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: "medium", timeStyle: "medium" })


function durationStringFromSeconds(duration_seconds) {
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

    if (duration_seconds >= 0) {
        components.push(`${duration_seconds.toFixed(0)} sec`)
    }
    
    return components.join(', ')
}


export default function TimeSlider(props) {

    if (props.tMin == null || props.tMax == null) {
        return (<div></div>)
    }

    function mouseEvent(evt) {
        if (!(evt.buttons & 1)) {
            return
        }
    
        const fraction = evt.clientX / evt.target.clientWidth
        const t = props.tMin + fraction * (props.tMax - props.tMin)

        props.onValueChanged?.(t)
    }

    const t = props.t ?? props.tMin
    const fraction = (t - props.tMin) / (props.tMax - props.tMin)
    
    const dateString = formatter.format(new Date(t / 1e3))
    const elapsedTimeString = durationStringFromSeconds((t - props.tMin) / 1e6)

    var slider = (
        <div className='TimeSlider flexbox vertical' onMouseDown={mouseEvent} onMouseMove={mouseEvent}>
            <div className='TimeSliderBack'>
                {TimeSliderPast(fraction ?? 0)}
            </div>
            <div className="TimeSliderStatus">{`${dateString}  (${elapsedTimeString})`}</div>
        </div>
    )

    return slider

}

function TimeSliderPast(fraction) {
    return (
        <div className='TimeSliderPast' style={{width: `${fraction * 100}%`}}></div>
    )
}
