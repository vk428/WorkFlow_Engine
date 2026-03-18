import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const RoleRoute = ({ children, allowedRoles }) => {
    const { user, isAuthenticated } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(user?.role)) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-10 text-center gap-4">
                <div className="text-danger bg-danger/10 p-4 rounded-full border border-danger/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                </div>
                <h1 className="text-3xl font-bold text-white">Access Denied</h1>
                <p className="text-slate-400 max-w-md">You do not have the necessary permissions to access this module. Please contact your administrator if you believe this is an error.</p>
                <button onClick={() => window.history.back()} className="btn-secondary mt-4">Go Back</button>
            </div>
        );
    }

    return children;
};

export default RoleRoute;
