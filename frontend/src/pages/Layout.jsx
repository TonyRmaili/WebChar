import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import GlobalPopupLayer from "../components/popups/GlobalPopupLayer";
import { loadAppearance } from "../styles/theme";

// The user's theme and colours (Settings → Appearance), applied once as
// the app loads so the first paint is already in the right look.
loadAppearance();

/* The frame around every page: the header, the page on the dark desk
   (desk-deep — dark leather brown in parchment, slate in classic), the
   card windows, and the footer. */
function Layout() {
  return (
    <div>
      <header>
        <Header />
      </header>
      <div className="min-h-screen bg-desk-deep">
        <Outlet />
        <GlobalPopupLayer />
      </div>
      <footer>
        <Footer />
      </footer>
    </div>
  );
}

export default Layout;