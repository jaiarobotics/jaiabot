# react-gamepad [![npm][npm-image]][npm-url]

[npm-image]: https://img.shields.io/npm/v/react-gamepad.svg
[npm-url]: https://npmjs.org/package/react-gamepad

A Gamepad handler as a React component

```bash
npm install react-gamepad --save
```

This component provides handlers for gamepad events, to use directly in your React components


## Usage example

```js
import Gamepad from 'react-gamepad'

class App extends Component {
  connectHandler(gamepadIndex) {
    console.log(`Gamepad ${gamepadIndex} connected !`)
  }

  disconnectHandler(gamepadIndex) {
    console.log(`Gamepad ${gamepadIndex} disconnected !`)
  }

  buttonChangeHandler(buttonName, down) {
    console.log(buttonName, down)
  }

  axisChangeHandler(axisName, value, previousValue) {
    console.log(axisName, value)
  }

  buttonDownHandler(buttonName) {
    console.log(buttonName, 'down')
  }

  buttonUpHandler(buttonName) {
    console.log(buttonName, 'up')
  }

  render() {
    return (
      <Gamepad
        onConnect={this.connectHandler}
        onDisconnect={this.disconnectHandler}

        onButtonChange={this.buttonChangeHandler}
        onAxisChange={this.axisChangeHandler}
      />
    )
  }
}
```

## API

### Props

```js
    <Gamepad
      gamepadIndex={Number}
      stickThreshold={Number}
      deadZone={Number}
      layout={Object}

      onConnect={(gamepadIndex) => {}}
      onDisconnect={(gamepadIndex) => {}}

      onButtonDown={(buttonName) => {}},
      onButtonUp={(buttonName) => {}},
      onButtonChange={(buttonName, pressed) => {}},
      onAxisChange={(axisName, value, previousValue) => {}},

      onA={() => {}},
      onB={() => {}},
      onX={() => {}},
      onY={() => {}},

      onStart={() => {}},
      onBack={() => {}},

      onLT={() => {}},
      onRT={() => {}},

      onLB={() => {}},
      onRB={() => {}},

      onLS={() => {}},
      onRS={() => {}},

      onUp={() => {}},
      onDown={() => {}},
      onLeft={() => {}},
      onRight={() => {}},
    />
```

#### gamepadIndex
The index of the gamepad to use, from 0 to 4
**Default: 0**

#### stickThreshold
Threshold above which `onUp`, `onDown`,`onLeft`,`onRight` are triggered for the left stick
**Default: 0.75**

#### deadZone
Threshold below which the axis values will be rounded to `0.0`
**Default: 0.08**

#### layout
Layout to use, from `Gamepad.layouts`. For now, only `Gamepad.layouts.XBOX` exists
**Default: Gamepad.layouts.XBOX**

#### onConnect
`onConnect(gamepadIndex: Number)` triggered when the gamepad connects. Will be triggered at least once after the `Gamepad` component is mounted.

#### onDisconnect
`onDisconnect(gamepadIndex: Number)` triggered when the gamepad disconnects.

#### onButtonDown
`onButtonDown(buttonName: String)` triggered when a button is pushed. `buttonName` is one of `A`, `B`, `X`, `Y`, `Start`, `Back`, `LT`, `RT`, `LB`, `RB`, `LS`, `RS`, `DPadUp`, `DPadDown`, `DPadLeft`, `DPadRight`

#### onButtonUp
`onButtonUp(buttonName: String)` triggered when a button is released. `buttonName` is one of `A`, `B`, `X`, `Y`, `Start`, `Back`, `LT`, `RT`, `LB`, `RB`, `LS`, `RS`, `DPadUp`, `DPadDown`, `DPadLeft`, `DPadRight`

#### onButtonChange
`onButtonChange(buttonName: String, pressed: Bool)` triggered when a button is pushed or released. `buttonName` is one of `A`, `B`, `X`, `Y`, `Start`, `Back`, `LT`, `RT`, `LB`, `RB`, `LS`, `RS`, `DPadUp`, `DPadDown`, `DPadLeft`, `DPadRight`

#### onAxisChange
`onAxisChange(axisName: String, value: Number, previousValue: Number)` triggered when an axis is changed. `axisName` is one of `LeftStickX`, `LeftStickY`, `RightStickX`, `RightStickY`, `LeftTrigger`, `RightTrigger`

#### onA
`onA()` triggered when the `A` button is pressed.

#### onB
`onB()` triggered when the `B` button is pressed.

#### onX
`onX()` triggered when the `X` button is pressed.

#### onY
`onY()` triggered when the `Y` button is pressed.

#### onLT
`onLT()` triggered when the `LT` button is pressed.

#### onRT
`onRT()` triggered when the `RT` button is pressed.

#### onLB
`onLB()` triggered when the `LB` button is pressed.

#### onRB
`onRB()` triggered when the `RB` button is pressed.

#### onLS
`onLS()` triggered when the `LS` button is pressed.

#### onRS
`onRS()` triggered when the `RS` button is pressed.

#### onUp
`onUp()` triggered when the `D Pad Up` button is pressed or the Left Stick is pushed up (above `stickThreshold`).

#### onDown
`onDown()` triggered when the `D Pad Down` button is pressed or the Left Stick is pushed down (above `stickThreshold`).

#### onLeft
`onLeft()` triggered when the `D Pad Left` button is pressed or the Left Stick is pushed left (above `stickThreshold`).

#### onRight
`onRight()` triggered when the `D Pad Right` button is pressed or the Left Stick is pushed right (above `stickThreshold`).

## Support on Beerpay
Hey dude! Help me out for a couple of :beers:!

[![Beerpay](https://beerpay.io/SBRK/react-gamepad/badge.svg?style=beer-square)](https://beerpay.io/SBRK/react-gamepad)  [![Beerpay](https://beerpay.io/SBRK/react-gamepad/make-wish.svg?style=flat-square)](https://beerpay.io/SBRK/react-gamepad?focus=wish)