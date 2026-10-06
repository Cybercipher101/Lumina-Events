import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './Components/ui/Toast';
import Layout from './Components/layout/Layout';
import ProtectedRoute from './Components/layout/ProtectedRoute';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import EventDetails from './pages/EventDetails';
import CreateEvent from './pages/CreateEvent';
import MyBookings from './pages/MyBookings';
import MyEvents from './pages/MyEvents';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Public Routes */}
              <Route index element={<Landing />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="events/:id" element={<EventDetails />} />

              {/* Protected Routes (All Auth Users) */}
              <Route 
                path="my-bookings" 
                element={
                  <ProtectedRoute>
                    <MyBookings />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Routes (Organizers Only) */}
              <Route 
                path="create-event" 
                element={
                  <ProtectedRoute roles={['organizer']}>
                    <CreateEvent />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="my-events" 
                element={
                  <ProtectedRoute roles={['organizer']}>
                    <MyEvents />
                  </ProtectedRoute>
                } 
              />

              {/* Catch All */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
