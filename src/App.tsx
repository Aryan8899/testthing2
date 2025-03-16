"use client";
import Header from "../src/layouts/Header";
import Footer from "../src/layouts/footer";
import Pool from "../src/pages/pool";
import Liquidity from "../src/pages/liquidity";
import "react-toastify/dist/ReactToastify.css";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import SwapPage from "../src/pages/Swap";
import "@mysten/dapp-kit/dist/index.css";
import Main from "../src/pages/Main";
import RemoveLiquidity from "../src/pages/RemoveLiquidity";

export default function App() {
  return (
    <Router>
      <Header />
      <div className="min-h-screen text-white">
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/swap" element={<SwapPage />} />
          <Route path="/pool" element={<Pool />} />
          <Route path="/addliquidity" element={<Liquidity />} />
          <Route path="/removeliquidity" element={<RemoveLiquidity />} />
        </Routes>
      </div>
      <Footer />
    </Router>
  );
}
