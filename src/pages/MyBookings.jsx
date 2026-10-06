import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Ticket, Calendar, MapPin, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { bookingsAPI } from '../services/api';
import { useToast } from '../Components/ui/Toast';
import Badge from '../Components/ui/Badge';
import Button from '../Components/ui/Button';
import { formatPrice } from '../utils/helpers';
import './MyBookings.css';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const toast = useToast();
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await bookingsAPI.getMy();
      setBookings(data.bookings);
      setLoadError('');
    } catch (error) {
      setLoadError('Unable to load your tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    setCancellingId(id);
    try {
      await bookingsAPI.cancel(id);
      toast.success('Booking cancelled successfully');
      fetchBookings(); // Refresh list
    } catch (error) {
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner spinner-dark"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="section-header">
          <h2>My Tickets</h2>
          <span className="events-count">{bookings.length} Bookings</span>
        </div>

        {loadError ? (
          <div role="alert" className="empty-state glass">
            <p>{loadError}</p>
            <Button onClick={fetchBookings}>Try Again</Button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="empty-state glass">
            <div className="empty-state-icon">
              <Ticket size={48} />
            </div>
            <h3>No bookings yet</h3>
            <p>You haven't booked tickets for any events.</p>
            <Link to="/">
              <Button>Browse Events</Button>
            </Link>
          </div>
        ) : (
          <div className="bookings-list">
            {bookings.map((booking, index) => {
              const event = booking.event || booking.event_snapshot || {};
              const date = event.start_date ? new Date(event.start_date) : null;
              const hasDate = date && !Number.isNaN(date.getTime());
              return (
              <motion.div 
                key={booking._id}
                className={`booking-card-horizontal glass ${booking.booking_status === 'cancelled' ? 'booking-cancelled' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div className="booking-date-block">
                  <span className="booking-month">{hasDate ? format(date, 'MMM') : '—'}</span>
                  <span className="booking-day">{hasDate ? format(date, 'dd') : '—'}</span>
                </div>
                
                <div className="booking-details">
                  <div className="booking-header">
                    <h3>{event.title || 'Event details unavailable'}</h3>
                    <Badge className={
                      booking.booking_status === 'confirmed' ? 'status-confirmed' : 
                      booking.booking_status === 'cancelled' ? 'status-cancelled' : 'status-pending'
                    }>
                      {booking.booking_status}
                    </Badge>
                  </div>
                  
                  <div className="booking-meta">
                    <span><Calendar size={14} /> {hasDate ? format(date, 'h:mm a') : 'Date unavailable'}</span>
                    <span><MapPin size={14} /> {event.venue_name || 'Venue unavailable'}{event.venue_city ? `, ${event.venue_city}` : ''}</span>
                    <span><Ticket size={14} /> {booking.number_of_tickets} Ticket(s)</span>
                  </div>
                  
                  {event.status === 'cancelled' && <p className="text-danger">The organizer has cancelled this event.</p>}
                  {!booking.event && <p>Event details are unavailable. Contact the organizer if you need help.</p>}
                  <div className="booking-ref">
                    Reference: <strong>{booking.booking_reference}</strong>
                  </div>
                </div>

                <div className="booking-actions">
                  <div className="booking-price">
                    {formatPrice(booking.total_amount, booking.event_snapshot?.currency || event.currency || 'INR')}
                  </div>
                  {booking.booking_status === 'confirmed' && booking.event && (
                    <Button 
                      variant="danger" 
                      size="sm" 
                      onClick={() => handleCancelBooking(booking._id)}
                      loading={cancellingId === booking._id}
                    >
                      <XCircle size={14} /> Cancel
                    </Button>
                  )}
                </div>
              </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
