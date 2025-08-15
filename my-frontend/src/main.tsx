import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PricesProvider } from "./context/PricesContext";
import { AuthProvider } from "./context/AuthContext";
import { MeProvider } from "./context/MeContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import App from "./App";
import './index.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PricesProvider>
        <AuthProvider>
          <CurrencyProvider>
            <MeProvider>
              <App />
            </MeProvider>
          </CurrencyProvider>
        </AuthProvider>
      </PricesProvider>
    </BrowserRouter>
  </React.StrictMode>
);
