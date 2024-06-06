import "./style/app.css";

import React, { Component } from "react";

import CommandControl from "./components/CommandControl";

export default class App extends Component {
    // state = { username: null };

    componentDidMount() {
        /*
    fetch('/api/getUsername')
      .then(res => res.json())
      .then(user => this.setState({ username: user.username }));
      */
    }

    render() {
        // const { username } = this.state;
        return (
            <div>
                <CommandControl />
                {/* {username ? <h1>{`Hello ${username}`}</h1> : <h1>Loading.. please wait!</h1>}   */}
            </div>
        );
    }
}
