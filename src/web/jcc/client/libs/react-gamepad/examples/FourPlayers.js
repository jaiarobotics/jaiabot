import React, { Component } from "react";

import Gamepad from "react-gamepad";

class PlayerCube extends Component {
    constructor(props) {
        super(props);

        this.state = {
            speedX: 0.0,
            speedY: 0.0,

            x: props.x,
            y: props.y,

            connected: false,
        };
    }

    componentDidMount() {
        window.requestAnimationFrame(this.update.bind(this));
    }

    connectHandler(gamepadIndex) {
        console.log(`Gamepad ${gamepadIndex} connected!`);

        this.setState({
            connected: true,
        });
    }

    disconnectHandler(gamepadIndex) {
        console.log(`Gamepad ${gamepadIndex} disconnected !`);

        this.setState({
            connected: false,
        });
    }

    update(datetime) {
        window.requestAnimationFrame(this.update.bind(this));

        const frameTime = datetime - this.previousFrameTime;
        this.previousFrameTime = datetime;

        if (isNaN(frameTime)) return;

        const baseSpeed = 300.0; // pixels per second
        const ratio = baseSpeed * (frameTime / 1000.0);

        this.setState({
            x: this.state.x + this.state.speedX * ratio,
            y: this.state.y - this.state.speedY * ratio,
        });
    }

    axisChangeHandler(axisName, value, previousValue) {
        if (axisName === "LeftStickX") {
            this.setState({
                speedX: value,
            });
        } else if (axisName === "LeftStickY") {
            this.setState({
                speedY: value,
            });
        }
    }

    getPlayerStyle() {
        return {
            height: "50px",
            width: "50px",

            background: this.props.color,
            color: "white",

            fontSize: "20px",
            textAlign: "center",
            lineHeight: "50px",

            position: "fixed",

            top: Math.round(this.state.y) + "px",
            left: Math.round(this.state.x) + "px",
        };
    }

    render() {
        return (
            <Gamepad
                gamepadIndex={this.props.playerIndex}
                onConnect={this.connectHandler.bind(this)}
                onDisconnect={this.disconnectHandler.bind(this)}
                onAxisChange={this.axisChangeHandler.bind(this)}
            >
                {this.state.connected && (
                    <div id={`player${this.props.playerIndex}`} style={this.getPlayerStyle()}>
                        {this.props.playerIndex}
                    </div>
                )}
            </Gamepad>
        );
    }
}

class FourPlayersExample extends Component {
    render() {
        return (
            <div>
                <PlayerCube playerIndex={0} color="red" x={300.0} y={200.0} />
                <PlayerCube playerIndex={1} color="blue" x={300.0} y={300.0} />
                <PlayerCube playerIndex={2} color="green" x={400.0} y={200.0} />
                <PlayerCube playerIndex={3} color="black" x={400.0} y={300.0} />
            </div>
        );
    }
}

export default FourPlayersExample;
