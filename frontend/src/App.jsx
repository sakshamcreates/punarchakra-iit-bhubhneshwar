import { Routes, Route } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import HomePage from "./pages/HomePage";
import SellPage from "./pages/SellPage";
import SellResultsPage from "./pages/SellResultsPage";
import DashboardPage from "./pages/DashboardPage";
import AuctionsPage from "./pages/AuctionsPage";
import AuctionDetailPage from "./pages/AuctionDetailPage";
import ScrapPage from "./pages/ScrapPage";
import MarketplacePage from "./pages/MarketplacePage";
import MarketplaceListingPage from "./pages/MarketplaceListingPage";
import PartnerDashboard from "./pages/partner/PartnerDashboard";
import PartnerPickups from "./pages/partner/PartnerPickups";
import PartnerInventory from "./pages/partner/PartnerInventory";
import PartnerRoutes from "./pages/partner/PartnerRoutes";
import BusinessOverview from "./pages/business/BusinessOverview";
import BusinessAssets from "./pages/business/BusinessAssets";
import BusinessStrategy from "./pages/business/BusinessStrategy";
import BusinessCSR from "./pages/business/BusinessCSR";
import BusinessProcurement from "./pages/business/BusinessProcurement";
import RepairShopPage from "./pages/RepairShopPage";
import RecyclerPage from "./pages/RecyclerPage";
import AuthPage from "./pages/AuthPage";
import AgentResolutionPage from "./pages/AgentResolutionPage";

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sell" element={<SellPage />} />
        <Route path="/sell/results" element={<SellResultsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auctions" element={<AuctionsPage />} />
        <Route path="/auctions/:id" element={<AuctionDetailPage />} />
        <Route path="/scrap" element={<ScrapPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/:id" element={<MarketplaceListingPage />} />
        <Route path="/partner" element={<PartnerDashboard />} />
        <Route path="/partner/pickups" element={<PartnerPickups />} />
        <Route path="/partner/inventory" element={<PartnerInventory />} />
        <Route path="/partner/routes" element={<PartnerRoutes />} />
        <Route path="/business" element={<BusinessOverview />} />
        <Route path="/business/assets" element={<BusinessAssets />} />
        <Route path="/business/strategy" element={<BusinessStrategy />} />
        <Route path="/business/csr" element={<BusinessCSR />} />
        <Route path="/business/procurement" element={<BusinessProcurement />} />
        <Route path="/repair-shop" element={<RepairShopPage />} />
        <Route path="/recycler" element={<RecyclerPage />} />
        <Route path="/agent/:itemId" element={<AgentResolutionPage />} />
      </Routes>
    </div>
  );
}
