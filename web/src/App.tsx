// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { GuestOnly, RequireAuth } from "./components/AuthRoute";
import { authStorage } from "../library/AuthStorage";

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

function HomeRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={authStorage.getRedirectPath(user.role)} replace />;
  }

  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes — logged-in users cannot stay here */}
          <Route
            path="/login"
            element={
              <GuestOnly>
                <Login />
              </GuestOnly>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestOnly>
                <Signup />
              </GuestOnly>
            }
          />
          <Route path="/" element={<HomeRedirect />} />

          {/* Secretary */}
          <Route
            path="admin/secretary"
            element={
              <RequireAuth roles={['secretary']}>
                <SecretarySidebar />
              </RequireAuth>
            }
          >
            <Route path="dashboard" element={<SecretaryDashboard />} />
            <Route path="manage-requests" element={<ManageRequests />} />
            <Route path="manage-inventory" element={<ManageInventory />} />
            <Route path="scheduled-services" element={<ScheduledServices />} />
            <Route path="service-records" element={<ServiceRecords />} />
            <Route path="manage-priests" element={<ManagePriests />} />
          </Route>

          {/* Cashier */}
          <Route
            path="admin/cashier/dashboard"
            element={
              <RequireAuth roles={['cashier']}>
                <CashierDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="admin/cashier/manage-unpaid-request"
            element={
              <RequireAuth roles={['cashier']}>
                <ManageUnpaidRequest />
              </RequireAuth>
            }
          />
          <Route
            path="admin/cashier/mass-financial"
            element={
              <RequireAuth roles={['cashier']}>
                <MassFinancial />
              </RequireAuth>
            }
          />

          {/* Priest */}
          <Route
            path="/priest/PriestHomePage"
            element={
              <RequireAuth roles={['priest']}>
                <PriestHomePage />
              </RequireAuth>
            }
          />

          {/* Parishioner (web legacy) */}
          <Route
            path="/parishioner/ParishionerHomePage"
            element={
              <RequireAuth roles={['parishioner']}>
                <ParishionerHome />
              </RequireAuth>
            }
          />
          <Route
            path="/parishioner/church-service"
            element={
              <RequireAuth roles={['parishioner']}>
                <ParishionerChurchService />
              </RequireAuth>
            }
          />
          <Route
            path="/parishioner/profile"
            element={
              <RequireAuth roles={['parishioner']}>
                <ParishionerProfile />
              </RequireAuth>
            }
          />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
