import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import WorkflowList from './pages/WorkflowList';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Monitor from './pages/Monitor';
import ApprovalCenter from './pages/ApprovalCenter';
import Notifications from './pages/Notifications';
import UserManagement from './pages/UserManagement';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import MyTasks from './pages/MyTasks';
import MyRequests from './pages/MyRequests';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';



function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />

        {/* Protected Application Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Workflows: Admin sees all (manage), User sees my (participate) */}
                <Route path="/workflows" element={<WorkflowList />} />

                {/* Admin Only Routes */}
                <Route path="/users" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <UserManagement />
                  </RoleRoute>
                } />
                <Route path="/analytics" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <Analytics />
                  </RoleRoute>
                } />
                <Route path="/reports" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <Reports />
                  </RoleRoute>
                } />
                <Route path="/system-monitor" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <Monitor />
                  </RoleRoute>
                } />
                <Route path="/settings" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <Settings />
                  </RoleRoute>
                } />

                {/* Shared / User Specific */}
                <Route path="/workflows/build/:id" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <WorkflowBuilder />
                  </RoleRoute>
                } />

                <Route path="/approvals" element={<ApprovalCenter />} />
                <Route path="/my-tasks" element={<MyTasks />} />
                <Route path="/my-requests" element={<MyRequests />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
