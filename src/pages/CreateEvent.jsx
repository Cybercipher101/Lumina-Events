import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlusCircle, Calendar, MapPin, Image as ImageIcon, DollarSign, Users } from 'lucide-react';
import { eventsAPI } from '../services/api';
import { useToast } from '../Components/ui/Toast';
import Input from '../Components/ui/Input';
import Select from '../Components/ui/Select';
import Textarea from '../Components/ui/Textarea';
import Button from '../Components/ui/Button';

export default function CreateEvent() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    title: '',
    event_type: 'conference',
    description: '',
    start_date: '',
    end_date: '',
    venue_name: '',
    venue_address: '',
    venue_city: '',
    ticket_price: '',
    total_capacity: '',
    image_url: ''
  });

  const EVENT_TYPES = [
    { value: 'conference', label: 'Conference' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'gala', label: 'Gala' },
    { value: 'tournament', label: 'Tournament' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'webinar', label: 'Webinar' },
    { value: 'concert', label: 'Concert' },
    { value: 'exhibition', label: 'Exhibition' },
    { value: 'networking', label: 'Networking' },
    { value: 'seminar', label: 'Seminar' }
  ];

  const update = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) errs.title = 'Title is required';
    if (!formData.start_date) errs.start_date = 'Start date is required';
    if (!formData.venue_name.trim()) errs.venue_name = 'Venue name is required';
    if (!formData.venue_city.trim()) errs.venue_city = 'City is required';
    if (!formData.ticket_price) errs.ticket_price = 'Price is required';
    else if (Number(formData.ticket_price) < 0) errs.ticket_price = 'Cannot be negative';
    if (!formData.total_capacity) errs.total_capacity = 'Capacity is required';
    else if (Number(formData.total_capacity) < 1) errs.total_capacity = 'Must be at least 1';
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      const dataToSubmit = {
        ...formData,
        ticket_price: Number(formData.ticket_price),
        total_capacity: Number(formData.total_capacity)
      };

      const res = await eventsAPI.create(dataToSubmit);
      toast.success('Event created successfully!');
      navigate(`/events/${res.event._id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create event');
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-content" style={{ maxWidth: '800px' }}>
        <div className="section-header">
          <h2>Create New Event</h2>
        </div>

        <motion.div 
          className="glass-strong" 
          style={{ padding: 'var(--space-8)', borderRadius: 'var(--radius-xl)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {errors.general && (
            <div className="auth-error-banner" style={{ marginBottom: 'var(--space-6)' }}>
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <Input
                id="title"
                label="Event Title *"
                value={formData.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="E.g., Tech Startup Mixer 2025"
                error={errors.title}
              />
              <Select
                id="event_type"
                label="Event Type *"
                value={formData.event_type}
                onChange={(e) => update('event_type', e.target.value)}
                options={EVENT_TYPES}
              />
            </div>

            <Textarea
              id="description"
              label="Event Description"
              rows={4}
              value={formData.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Tell attendees what to expect..."
            />

            <div className="form-row" style={{ marginTop: 'var(--space-5)' }}>
              <Input
                id="start_date"
                label="Start Date & Time *"
                type="datetime-local"
                icon={<Calendar size={15} />}
                value={formData.start_date}
                onChange={(e) => update('start_date', e.target.value)}
                error={errors.start_date}
              />
              <Input
                id="end_date"
                label="End Date & Time"
                type="datetime-local"
                icon={<Calendar size={15} />}
                value={formData.end_date}
                onChange={(e) => update('end_date', e.target.value)}
              />
            </div>

            <div className="form-row" style={{ marginTop: 'var(--space-5)' }}>
              <Input
                id="venue_name"
                label="Venue Name *"
                icon={<MapPin size={15} />}
                value={formData.venue_name}
                onChange={(e) => update('venue_name', e.target.value)}
                placeholder="E.g., Convention Center"
                error={errors.venue_name}
              />
              <Input
                id="venue_city"
                label="City *"
                value={formData.venue_city}
                onChange={(e) => update('venue_city', e.target.value)}
                placeholder="E.g., Bangalore"
                error={errors.venue_city}
              />
            </div>

            <Input
              id="venue_address"
              label="Full Address"
              value={formData.venue_address}
              onChange={(e) => update('venue_address', e.target.value)}
              placeholder="Street address..."
            />

            <div className="form-row-3" style={{ marginTop: 'var(--space-5)' }}>
              <Input
                id="ticket_price"
                label="Ticket Price (₹) *"
                type="number"
                min="0"
                icon={<DollarSign size={15} />}
                value={formData.ticket_price}
                onChange={(e) => update('ticket_price', e.target.value)}
                placeholder="0 for free"
                error={errors.ticket_price}
              />
              <Input
                id="total_capacity"
                label="Total Capacity *"
                type="number"
                min="1"
                icon={<Users size={15} />}
                value={formData.total_capacity}
                onChange={(e) => update('total_capacity', e.target.value)}
                placeholder="Number of tickets"
                error={errors.total_capacity}
              />
              <Input
                id="image_url"
                label="Image URL"
                icon={<ImageIcon size={15} />}
                value={formData.image_url}
                onChange={(e) => update('image_url', e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)', marginTop: 'var(--space-8)' }}>
              <Button type="button" variant="outline" onClick={() => navigate('/my-events')}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} size="lg">
                <PlusCircle size={18} /> Publish Event
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
