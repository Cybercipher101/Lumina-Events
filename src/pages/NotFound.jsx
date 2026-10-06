import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../Components/ui/Button';

export default function NotFound() {
  return (
    <div className="page-container flex-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="empty-state glass" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="empty-state-icon" style={{ background: 'var(--danger-light)' }}>
          <AlertCircle size={48} color="var(--danger)" />
        </div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>404</h1>
        <h3 style={{ marginBottom: '1rem' }}>Page Not Found</h3>
        <p style={{ marginBottom: '2rem' }}>
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button size="lg" fullWidth>Return to Home</Button>
        </Link>
      </div>
    </div>
  );
}
