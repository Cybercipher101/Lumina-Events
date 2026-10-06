import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Calendar, Home, Ticket, PlusCircle, LogOut, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

export default function Sidebar() {
  const { user, isAuthenticated, isOrganizer, logout, authError } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Link to="/" className="brand-logo">
          <div className="logo-icon">
            <Calendar size={24} />
          </div>
          <span className="brand-text text-gradient">Lumina</span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          <li className="nav-item">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <Home size={20} />
              <span>Discover</span>
            </NavLink>
          </li>
          {/* <li className="nav-item">
            <NavLink to="/search" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Search size={20} />
              <span>Search</span>
            </NavLink>
          </li> */}

          {isAuthenticated && (
            <>
              <li className="nav-divider"></li>
              <li className="nav-header">My Account</li>
              
              <li className="nav-item">
                <NavLink to="/my-bookings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Ticket size={20} />
                  <span>My Tickets</span>
                </NavLink>
              </li>

              {isOrganizer && (
                <>
                  <li className="nav-item">
                    <NavLink to="/my-events" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      <Calendar size={20} />
                      <span>My Events</span>
                    </NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/create-event" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      <PlusCircle size={20} />
                      <span>Create Event</span>
                    </NavLink>
                  </li>
                </>
              )}
            </>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {authError && <p role="alert" className="text-danger">{authError}</p>}
        {isAuthenticated ? (
          <div className="user-profile">
            <div className="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name line-clamp-1">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="btn btn-outline btn-full" style={{ marginBottom: '8px' }}>
              <LogIn size={16} /> Sign In
            </Link>
            <Link to="/register" className="btn btn-primary btn-full">
              <UserPlus size={16} /> Sign Up
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
