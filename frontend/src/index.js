import React from 'react';
import ReactDOM from 'react-dom/client';
import IntegratedApp from './IntegratedApp';
import { initNativeApp } from './capacitorSetup';
import './App.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<IntegratedApp />);

// No-op on the web; wires up splash screen / status bar / Android back button
// when this bundle is running inside the Capacitor Android or iOS app shell.
initNativeApp();
