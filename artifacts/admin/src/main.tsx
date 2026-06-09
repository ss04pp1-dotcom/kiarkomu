import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Try the workspace alias first (same as mobile)
import { setBaseUrl } from "@workspace/api-client-react";

// If the above fails during build, replace it with the relative path below:
// import { setBaseUrl } from "../../../lib/api-client-react/src";

setBaseUrl(import.meta.env.VITE_API_URL ?? null);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);