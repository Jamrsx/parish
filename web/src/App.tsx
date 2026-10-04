// App.tsx
import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { GuestOnly, RequireAuth } from "./components/AuthRoute";
import { authStorage } from "../library/AuthStorage";
import PageLoader from "./components/PageLoader";

// Auth Pages
import Login from "./(auth)/login";
import Signup from "./(auth)/signup";

// Admin - Secretary (layout shell stays eager so the sidebar never flickers)
import SecretarySidebar from './(protected)/Admin/Secretary_Dashboard/Secretary_Sidebar';

const lazyPage = (name: string, loader: () => Promise<{ default: ComponentType }>) =>
  lazy(() => {
    console.log(`[Router] Loading page: ${name}`);
    return loader();
  });

const SecretaryDashboard = lazyPage("SecretaryDashboard", () => import("./(protected)/Admin/Secretary_Dashboard/SecretaryHomePage"));
const ManageRequests = lazyPage("ManageRequests", () => import("./(protected)/Admin/Secretary_Dashboard/Manage_Requests"));
const ManageInventory = lazyPage("ManageInventory", () => import("./(protected)/Admin/Secretary_Dashboard/Inventory/Manage_Inventory"));
const ScheduledServices = lazyPage("ScheduledServices", () => import("./(protected)/Admin/Secretary_Dashboard/Scheduled_Services"));
const ServiceRecords = lazyPage("ServiceRecords", () => import("./(protected)/Admin/Secretary_Dashboard/Service_Records"));
const ManagePriests = lazyPage("ManagePriests", () => import("./(protected)/Admin/Secretary_Dashboard/Manage_Priests"));
const ManageCashiers = lazyPage("ManageCashiers", () => import("./(protected)/Admin/Secretary_Dashboard/Manage_Cashiers"));
const ManageDonations = lazyPage("ManageDonations", () => import("./(protected)/Admin/Secretary_Dashboard/Manage_Donations"));
const ManageMassCollections = lazyPage("ManageMassCollections", () => import("./(protected)/Admin/Secretary_Dashboard/Manage_Mass_Collections"));
const ManageSpecialIntentions = lazyPage("ManageSpecialIntentions", () => import("./(protected)/Admin/Secretary_Dashboard/Manage_Special_Intentions"));
const ManageServices = lazyPage("ManageServices", () => import("./(protected)/Admin/Secretary_Dashboard/Manage_Services"));
const ManageExpenses = lazyPage("ManageExpenses", () => import("./(protected)/Admin/Secretary_Dashboard/Manage_Expenses"));
const WalkInBooking = lazyPage("WalkInBooking", () => import("./(protected)/Admin/Secretary_Dashboard/Walk_In_Booking"));
const Certificates = lazyPage("Certificates", () => import("./(protected)/Admin/Secretary_Dashboard/Certificates/Certificates"));
const SecretaryParishHistory = lazyPage("SecretaryParishHistory", () => import("./(protected)/Admin/Secretary_Dashboard/Parish_History"));

// Admin - Cashier
const CashierDashboard = lazyPage("CashierDashboard", () => import("./(protected)/Admin/Cashier_Dashboard/CashierHomePage"));

// Priest
const PriestHomePage = lazyPage("PriestHomePage", () => import("./(protected)/Admin/Priest_Dashboard/PriestHomePage"));
const PriestCalendar = lazyPage("PriestCalendar", () => import("./(protected)/Admin/Priest_Dashboard/PriestCalendar"));
const PriestIncome = lazyPage("PriestIncome", () => import("./(protected)/Admin/Priest_Dashboard/PriestIncome"));
const PriestExpenses = lazyPage("PriestExpenses", () => import("./(protected)/Admin/Priest_Dashboard/PriestExpenses"));
const PriestInventory = lazyPage("PriestInventory", () => import("./(protected)/Admin/Priest_Dashboard/PriestInventory"));
const PriestHistory = lazyPage("PriestHistory", () => import("./(protected)/Admin/Priest_Dashboard/PriestHistory"));

// Parishioner
const ParishionerHome = lazyPage("ParishionerHome", () => import("./(protected)/Parishioner_Dashboard/ParishionerHomePage"));
const ParishionerChurchService = lazyPage("ParishionerChurchService", () => import("./(protected)/Parishioner_Dashboard/Church_service"));
const ParishionerProfile = lazyPage("ParishionerProfile", () => import("./(protected)/Parishioner_Dashboard/Profile"));

function HomeRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
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
        <Suspense fallback={<PageLoader />}>
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
            <Route path="manage-cashiers" element={<ManageCashiers />} />
            <Route path="donations" element={<ManageDonations />} />
            <Route path="mass-collections" element={<ManageMassCollections />} />
            <Route path="special-intentions" element={<ManageSpecialIntentions />} />
            <Route path="manage-services" element={<ManageServices />} />
            <Route path="walk-in-booking" element={<WalkInBooking />} />
            <Route path="expenses" element={<ManageExpenses />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="history" element={<SecretaryParishHistory />} />
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

          {/* Priest */}
          <Route
            path="/priest/PriestHomePage"
            element={
              <RequireAuth roles={['priest']}>
                <PriestHomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/priest/calendar"
            element={
              <RequireAuth roles={['priest']}>
                <PriestCalendar />
              </RequireAuth>
            }
          />
          <Route
            path="/priest/income"
            element={
              <RequireAuth roles={['priest']}>
                <PriestIncome />
              </RequireAuth>
            }
          />
          <Route
            path="/priest/expenses"
            element={
              <RequireAuth roles={['priest']}>
                <PriestExpenses />
              </RequireAuth>
            }
          />
          <Route
            path="/priest/inventory"
            element={
              <RequireAuth roles={['priest']}>
                <PriestInventory />
              </RequireAuth>
            }
          />
          <Route
            path="/priest/history"
            element={
              <RequireAuth roles={['priest']}>
                <PriestHistory />
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
