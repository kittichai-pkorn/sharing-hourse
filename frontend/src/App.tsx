import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Dashboard Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import MembersPage from './pages/dashboard/MembersPage';
import UsersPage from './pages/dashboard/UsersPage';
import ShareGroupsPage from './pages/dashboard/ShareGroupsPage';
import ShareGroupDetailPage from './pages/dashboard/ShareGroupDetailPage';
import CreateShareGroupPage from './pages/dashboard/CreateShareGroupPage';

// SuperAdmin Pages
import SuperAdminLoginPage from './pages/superadmin/SuperAdminLoginPage';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Dashboard Routes */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/share-groups" element={<ShareGroupsPage />} />
          <Route path="/share-groups/new" element={<CreateShareGroupPage />} />
          <Route path="/share-groups/:id" element={<ShareGroupDetailPage />} />
        </Route>

        {/* SuperAdmin Routes */}
        <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
