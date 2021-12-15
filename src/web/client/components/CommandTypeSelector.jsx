import React from 'react';

import cmdIconStop from '../icons/Stop.png';
import cmdIconLineFormation from '../icons/formations/LineFormation3.png';
import cmdIconCircleFormation from '../icons/formations/CircleFormation2.png';

import cmdIconBeep from '../icons/other_commands/beep.png';
// import cmdIconDefault from '../icons/other_commands/default.png';
import cmdIconDive from '../icons/other_commands/dive.png';
import cmdIconDiveBottom from '../icons/other_commands/DiveBottom.png';
import cmdIconDiveDefault from '../icons/other_commands/DiveDefault.png';
import cmdIconDiveDrift from '../icons/other_commands/DiveDrift.png';
import cmdIconDiveProfile from '../icons/other_commands/DiveProfile.png';
import cmdIconJump from '../icons/other_commands/Jump1.png';
import cmdIconRTH from '../icons/other_commands/rth.png';
import cmdIconLineData from '../icons/other_commands/SurfaceData.png';
import cmdIconOverrideOOW from '../icons/other_commands/OverrideOOW.png';
import cmdIconLED from '../icons/other_commands/LED.png';

function CommandTypeButton(props) {
  const { title, img, callback, command } = props

  function onClick(event) {
    callback(command)
  }

  return (
    <button type="button" className="commandType" title={title} onClick={onClick}>
      <img src={img} alt={title} />
    </button>
  )
}

function CommandTypeSelector(props) {
    const { callback } = props
    return (
      <div className="command-select">
      
        <CommandTypeButton 
          title="Line Formation" 
          img={cmdIconLineFormation} 
          callback={callback} 
          command={{
            type: 'formation',
            formationType: '5',
            OtherCommand: '0'
          }} />
          
        <CommandTypeButton 
          title="Circle Formation" 
          img={cmdIconCircleFormation} 
          callback={callback} 
          command={{
            type: 'formation',
            formationType: '6',
            OtherCommand: '0'
          }} />
          
        <CommandTypeButton 
          title="Sample Data at Surface" 
          img={cmdIconLineData} 
          callback={callback} 
          command={{
            type: 'other',
            formationType: '0',
            OtherCommand: '5'
          }} />
          
        <CommandTypeButton 
          title="Dive Bottom" 
          img={cmdIconDiveBottom} 
          callback={callback} 
          command={{
            type: 'other',
            formationType: '0',
            OtherCommand: '3'
          }} />

        <CommandTypeButton 
          title="Dive Drift" 
          img={cmdIconDiveDrift} 
          callback={callback} 
          command={{
            type: 'other',
            formationType: '0',
            OtherCommand: '4'
          }} />

        <CommandTypeButton 
          title="Dive Profile" 
          img={cmdIconDiveProfile} 
          callback={callback} 
          command={{
            type: 'other',
            formationType: '0',
            OtherCommand: '2'
          }} />

        <CommandTypeButton 
          title="Return Home" 
          img={cmdIconRTH} 
          callback={callback} 
          command={{
            type: 'other',
            formationType: '0',
            OtherCommand: '1'
          }} />

        <CommandTypeButton 
          title="Beep" 
          img={cmdIconBeep} 
          callback={callback} 
          command={{
            type: 'other',
            formationType: '0',
            OtherCommand: '0'
          }} />

        <CommandTypeButton 
          title="Blink Pattern" 
          img={cmdIconLED} 
          callback={callback} 
          command={{
            type: 'other',
            formationType: '0',
            OtherCommand: '11'
          }} />

        <CommandTypeButton 
          title="Wait" 
          img={cmdIconLED} 
          callback={callback} 
          command={{
            type: 'wait',
            formationType: '0',
            OtherCommand: '0'
          }} />

      </div>
    )
}

export default CommandTypeSelector
