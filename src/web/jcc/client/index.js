import React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';

let element = document.getElementById('root')
const root = ReactDOM.createRoot(element);
root.render(<App />);

module.hot.accept();
