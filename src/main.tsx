import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import "./styles.css";
import { AppProvider } from "@/lib/store";
import A11yMenu from "@/components/A11yMenu";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import { AccessibilityPage, PrivacyPage, TermsPage } from "@/pages/Legal";
import { MyOrders, NewOrder, MySettings } from "@/pages/portal/Portal";
import OrderPage from "@/pages/OrderPage";
import { AdminOrders, AdminNewOrder, AdminClients, AdminClient, AdminCatalog } from "@/pages/admin/Admin";
import { AdminImport } from "./pages/admin/Import";
import { PublicPage } from "@/components/Site";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <HashRouter>
        <ScrollTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/portal" element={<MyOrders />} />
          <Route path="/portal/new" element={<NewOrder />} />
          <Route path="/portal/settings" element={<MySettings />} />
          <Route path="/portal/order/:id" element={<OrderPage />} />
          <Route path="/admin" element={<AdminOrders />} />
          <Route path="/admin/new" element={<AdminNewOrder />} />
          <Route path="/admin/order/:id" element={<OrderPage admin />} />
          <Route path="/admin/clients" element={<AdminClients />} />
          <Route path="/admin/clients/:id" element={<AdminClient />} />
          <Route path="/admin/catalog" element={<AdminCatalog />} />
          <Route path="/admin/import" element={<AdminImport />} />
          <Route path="*" element={<PublicPage><div className="mx-auto max-w-xl px-5 py-24 text-center"><h1 className="text-4xl">העמוד לא נמצא</h1><a href="#/" className="btn-primary mt-6">לדף הבית</a></div></PublicPage>} />
        </Routes>
        <A11yMenu />
      </HashRouter>
    </AppProvider>
  </StrictMode>,
);
