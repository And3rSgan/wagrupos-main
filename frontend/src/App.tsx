/**
 * Site: plwdesign.online | Autor: Santos PLW / Alex
 */
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import GroupSenderPage from "./pages/GroupSenderPage";
import GroupsPage from "./pages/GroupsPage";
import DashboardPage from "./pages/DashboardPage";
import { ConnectionRoute } from "./components/ConnectionRoute";
import { DefaultRoute } from "./components/DefaultRoute";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SuperAdminRoute } from "./components/SuperAdminRoute";
import { SubscriptionGuard } from "./components/SubscriptionGuard";
import WhatsappConnectionPage from "./pages/WhatsappConnectionPage";
import CampaignsPage from "./pages/CampaignsPage";
import ProductsPage from "./pages/ProductsPage";
import TemplatesPage from "./pages/TemplatesPage";
import TypesPage from "./pages/TypesPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import HelpPage from "./pages/HelpPage";
import UserProfilePage from "./pages/UserProfilePage";
import SettingsPage from "./pages/SettingsPage";
import CompaniesPage from "./pages/CompaniesPage";
import PlansPage from "./pages/PlansPage";
import InvoicesPage from "./pages/InvoicesPage";
import AdminInvoicesPage from "./pages/AdminInvoicesPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SubscriptionGuard>
              <Layout />
            </SubscriptionGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultRoute />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="whatsapp/connection" element={<ConnectionRoute menuKey="whatsapp_connection"><WhatsappConnectionPage /></ConnectionRoute>} />
        <Route path="whatsapp/groups" element={<ConnectionRoute menuKey="whatsapp_groups"><GroupSenderPage /></ConnectionRoute>} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="types" element={<TypesPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="me" element={<UserProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="admin/companies" element={<SuperAdminRoute><CompaniesPage /></SuperAdminRoute>} />
        <Route path="admin/plans" element={<SuperAdminRoute><PlansPage /></SuperAdminRoute>} />
        <Route path="admin/invoices" element={<SuperAdminRoute><AdminInvoicesPage /></SuperAdminRoute>} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

