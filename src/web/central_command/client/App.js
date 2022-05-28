import React, { Component } from 'react';
import './style/app.css';
import AXUI from './components/AXUI';

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
        <AXUI />
        {/* {username ? <h1>{`Hello ${username}`}</h1> : <h1>Loading.. please wait!</h1>}   */}
      </div>
    );
  }
}
