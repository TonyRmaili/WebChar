import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import Layout from "./pages/Layout";
import FrontPage from "./pages/FrontPage";
import DiceTower from "./pages/DiceTower";
import CreateChar from "./pages/CreateChar"
import LoadChar from "./pages/LoadChar"
import CreateAccount from "./pages/CreateAccount"
import LogIn from "./pages/LogIn"
 


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<FrontPage />}></Route>
          <Route path="/diceTower" element={<DiceTower />}></Route>
          <Route path="/createChar" element={<CreateChar />}></Route>
          <Route path="/loadChar" element={<LoadChar />}></Route>
          <Route path="/createAccount" element={<CreateAccount />}></Route>
          <Route path="/logIn" element={<LogIn />}></Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
