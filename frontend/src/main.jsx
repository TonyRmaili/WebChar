import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Routes, Route, BrowserRouter } from "react-router-dom";

import Layout from "./pages/Layout";
import CharactersMain from "./pages/Characters/CharactersMain";
import CreateAccount from "./pages/CreateAccount"
import LogIn from "./pages/LogIn"
import Embedder from "./pages/Embedder"
import Settings from "./pages/Settings";
import MainCampaigns from "./pages/Campaigns/MainCampaigns";
import CataloguesMain from "./pages/Catalogues/CataloguesMain"



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<CharactersMain />}></Route>
          <Route path="/CharactersMain" element={<CharactersMain />}></Route>
          <Route path="/createAccount" element={<CreateAccount />}></Route>
          <Route path="/logIn" element={<LogIn />}></Route>
          <Route path="/Embedder" element={<Embedder />}></Route>
          <Route path="/Settings" element={<Settings />}></Route>
          <Route path="/MainCampaigns" element={<MainCampaigns />}></Route>
          <Route path="/CataloguesMain" element={<CataloguesMain />}></Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);