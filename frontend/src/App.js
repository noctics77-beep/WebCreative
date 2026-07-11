import "@/App.css";
import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import Storefront from "@/pages/Storefront";
import Partnership from "@/pages/Partnership";
import AffiliateDashboard from "@/pages/AffiliateDashboard";
import AdminPanel from "@/pages/AdminPanel";
import LoyaltyPage from "@/pages/LoyaltyPage";
import TrackOrder from "@/pages/TrackOrder";
import ProductDetail from "@/pages/ProductDetail";
import FAQ from "@/pages/FAQ";
import About from "@/pages/About";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import WelcomePopup from "@/components/WelcomePopup";
import MaintenanceGate from "@/components/MaintenanceGate";
import { initTracking, trackPageView } from "@/lib/tracking";

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  useEffect(() => {
    initTracking();
  }, []);

  return (
    <div className="App min-h-screen bg-[#0f1117] text-white">
      <BrowserRouter>
        <RouteTracker />
        <MaintenanceGate>
          <NavBar />
          <Routes>
            <Route path="/" element={<Storefront />} />
            <Route path="/produk/:slug" element={<ProductDetail />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/tentang" element={<About />} />
            <Route path="/partnership" element={<Partnership />} />
            <Route path="/affiliate" element={<AffiliateDashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/loyalty" element={<LoyaltyPage />} />
            <Route path="/lacak-pesanan" element={<TrackOrder />} />
          </Routes>
          <Footer />
          <ChatWidget />
          <WelcomePopup />
        </MaintenanceGate>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1d27",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#F8F9FA",
          },
        }}
      />
    </div>
  );
}
