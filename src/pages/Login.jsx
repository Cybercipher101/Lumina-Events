import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../Components/ui/Toast';
import Input from '../Components/ui/Input';
import Button from '../Components/ui/Button';
import './Auth.css';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!formData.email.trim()) errs.email = 'Email is required';
    if (!formData.password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await login(formData.email, formData.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Login failed');
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-header">
          <div className="auth-logo">
            <Calendar size={28} />
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in to your Lumina account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {errors.general && (
            <div className="auth-error-banner">{errors.general}</div>
          )}

          <Input
            id="login-email"
            label="Email Address"
            icon={<Mail size={15} />}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="you@example.com"
            error={errors.email}
          />

          <Input
            id="login-password"
            label="Password"
            icon={<Lock size={15} />}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Enter your password"
            error={errors.password}
          />

          <Button type="submit" fullWidth loading={loading} size="lg">
            <LogIn size={18} />
            Sign In
          </Button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Create one</Link></p>
        </div>

        <div className="auth-demo-info">
          <p><strong>Demo Accounts:</strong></p>
          <p>Organizer: organizer@eventhub.com / password123</p>
          <p>Attendee: attendee@eventhub.com / password123</p>
        </div>
      </motion.div>
    </div>
  );
}
