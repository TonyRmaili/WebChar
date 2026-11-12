import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import GlobalPopupLayer from "../components/popups/GlobalPopupLayer";
import { loadAppearance } from "../styles/theme";
import useAuthStore from "../store/AuthStore";

// The user's theme and colours (Settings → Appearance), applied once as
// the app loads so the first paint is already in the right look.
loadAppearance();

/* The frame around every page: the header, the page on the dark desk
   (desk-deep — dark leather brown in parchment, slate in classic), the
   card windows, and the footer.

   It also fetches the logged-in user (/me) once when the app starts:
   nothing about the user is kept in the browser, only the login token. */
function Layout() {
  const fetchUser = useAuthStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser(); // does nothing when nobody is logged in
  }, [fetchUser]);

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