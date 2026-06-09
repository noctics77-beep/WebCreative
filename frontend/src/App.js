import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Storefront from "@/pages/Storefront";
import Partnership from "@/pages/Partnership";
import AffiliateDashboard from "@/pages/AffiliateDashboard";
import AdminPanel from "@/pages/AdminPanel";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export default function App() {
  return (
    <div className="App min-h-screen bg-[#0f1117] text-white">
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<Storefront />} />
          <Route path="/partnership" element={<Partnership />} />
          <Route path="/affiliate" element={<AffiliateDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
        <Footer />
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
