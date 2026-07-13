// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";

// Auth Pages
import Login from "./(auth)/login";
import Signup from "./(auth)/signup";

// Admin - Secretary
import SecretarySidebar from './(protected)/Admin/Secretary_Dashboard/Secretary_Sidebar';
import SecretaryDashboard from "./(protected)/Admin/Secretary_Dashboard/SecretaryHomePage";
import ManageRequests from "./(protected)/Admin/Secretary_Dashboard/Manage_Requests";
import ManageInventory from "./(protected)/Admin/Secretary_Dashboard/Inventory/Manage_Inventory";
import ScheduledServices from "./(protected)/Admin/Secretary_Dashboard/Scheduled_Services";
import ServiceRecords from "./(protected)/Admin/Secretary_Dashboard/Service_Records";
import ManagePriests from "./(protected)/Admin/Secretary_Dashboard/Manage_Priests";

// Admin - Cashier
import CashierDashboard from "./(protected)/Admin/Cashier_Dashboard/CashierHomePage";
import ManageUnpaidRequest from "./(protected)/Admin/Cashier_Dashboard/Manage_Unpaid_Request";
import MassFinancial from "./(protected)/Admin/Cashier_Dashboard/Mass_Financial";

// Priest
import PriestHomePage from "./(protected)/Admin/Priest_Dashboard/PriestHomePage";

// Parishioner
import ParishionerHome from "./(protected)/Parishioner_Dashboard/ParishionerHomePage";
import ParishionerChurchService from "./(protected)/Parishioner_Dashboard/Church_service";
import ParishionerProfile from "./(protected)/Parishioner_Dashboard/Profile";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Admin Routes - Secretary & Cashier - WITH /admin/ PREFIX */}
          <Route>
            {/* Secretary Routes - NOW WITH /admin/ */}
            <Route path="admin/secretary" element={<SecretarySidebar />}>
              <Route path="dashboard" element={<SecretaryDashboard />} />
              <Route path="manage-requests" element={<ManageRequests />} />
              <Route path="manage-inventory" element={<ManageInventory />} />
              <Route path="scheduled-services" element={<ScheduledServices />} />
              <Route path="service-records" element={<ServiceRecords />} />
              <Route path="manage-priests" element={<ManagePriests />} />
            </Route>

            {/* Cashier Routes - NOW WITH /admin/ */}
            <Route
              path="admin/cashier/dashboard"
              element={<CashierDashboard />}
            />
            <Route
              path="admin/cashier/manage-unpaid-request"
              element={<ManageUnpaidRequest />}
            />
            <Route
              path="admin/cashier/mass-financial"
              element={<MassFinancial />}
            />
          </Route>

          {/* Priest Routes */}
          <Route path="/priest/PriestHomePage" element={<PriestHomePage />} />

          {/* Parishioner Routes */}
          <Route
            path="/parishioner/ParishionerHomePage"
            element={<ParishionerHome />}
          />
          <Route
            path="/parishioner/church-service"
            element={<ParishionerChurchService />}
          />
          <Route path="/parishioner/profile" element={<ParishionerProfile />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;