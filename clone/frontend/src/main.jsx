import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { Routes, Route, BrowserRouter } from 'react-router-dom'
import Layout from './pages/Layout';
import About from './pages/About';
import Login from "./pages/Login"
import Register from './pages/Register';
import User from './pages/User';
import Home from './pages/Home';
import Market from './pages/Market';
import OtherUserPage from './pages/OtherUserPage';
import InboxPage from './pages/InboxPage';

function App() {
  return (

    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />}></Route>
          <Route path="/login" element={<Login />}></Route>
          <Route path="/register" element={<Register />}></Route>
          <Route path="/user" element={<User />}></Route>
          <Route path="/other/:userName" element={<OtherUserPage />}></Route>
          <Route path="/about" element={<About />}></Route>
          <Route path="/market" element={<Market />}></Route>
          <Route path="/inbox" element={<InboxPage />}></Route>
        </Route>
      </Routes>
    </BrowserRouter>

  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
