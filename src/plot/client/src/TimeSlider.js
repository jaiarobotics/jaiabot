import React from 'react'

export default function TimeSlider(props) {

    function mouseEvent(evt) {
        if (!(evt.buttons & 1)) {
            return
        }
    
        const fraction = evt.clientX / evt.target.clientWidth

        props.onValueChanged?.(fraction)
    }
    
    var slider = (
        <div className='TimeSlider' onMouseDown={mouseEvent} onMouseMove={mouseEvent}>
            <div className='TimeSliderInner'>
                {knob(props.fraction ?? 0)}
            </div>
        </div>
    )

    return slider

}

function knob(fraction) {
    return (
        <div className='TimeSliderKnob' style={{left: `${fraction * 100}%`}}></div>
    )
}
