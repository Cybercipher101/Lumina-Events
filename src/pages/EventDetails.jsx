import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Share2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { eventsAPI, bookingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../Components/ui/Toast';
import Badge from '../Components/ui/Badge';
import Button from '../Components/ui/Button';
import BookingModal from '../Components/Events/BookingModal';
import { formatPrice, getTypeClass, capitalizeFirst } from '../utils/helpers';
import './EventDetails.css';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingProcessing, setBookingProcessing] = useState(false);
  const bookingPending = useRef(false);

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line
  }, [id]);

  const fetchEvent = async () => {
    try {
      const data = await eventsAPI.getOne(id);
      setEvent(data.event);
    } catch (error) {
      toast.error('Failed to load event details');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = () => {
    if (!isAuthenticated) {
      toast.info('Please log in to book tickets');
      navigate('/login');
      return;
    }
    setShowBookingModal(true);
  };

  const handleConfirmBooking = async (bookingData, requestKey) => {
    if (bookingPending.current) return;
    bookingPending.current = true;
    setBookingProcessing(true);
    try {
      const result = await bookingsAPI.create(bookingData, requestKey);
      if (result.booking.booking_status === 'cancelled') toast.info('This booking was already cancelled. You can view it in My Tickets.');
      else toast.success('Booking confirmed successfully!');
      setShowBookingModal(false);
      navigate('/my-bookings');
    } catch (error) {
      toast.error(error.message || 'Failed to process booking');
    } finally {
      setBookingProcessing(false);
      bookingPending.current = false;
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: `Check out ${event.title} on Lumina!`,
        url: window.location.href,
      }).catch(err => console.log('Error sharing', err));
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner spinner-dark"></div>
      </div>
    );
  }

  if (!event) return null;

  const availableTickets = event.total_capacity - event.tickets_sold;
  const isSoldOut = availableTickets <= 0;
  const unavailable = event.status !== 'published' || new Date(event.start_date) <= new Date();

  return (
    <div className="event-details-page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={20} /> Back
      </button>

      <div className="event-layout">
        {/* Left Column — Image & Details */}
        <div className="event-main">
          <motion.div 
            className="event-hero-image"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {event.image_url ? (
              <img src={event.image_url} alt={event.title} />
            ) : (
              <div className="event-hero-placeholder">
                <Calendar size={64} opacity={0.5} />
              </div>
            )}
            <div className="event-badges-overlay">
              <Badge className={getTypeClass(event.event_type)}>
                {capitalizeFirst(event.event_type)}
              </Badge>
              {event.featured && (
                <Badge className="badge-warning">Featured</Badge>
              )}
            </div>
          </motion.div>

          <motion.div 
            className="event-content glass"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h1>{event.title}</h1>
            
            <div className="event-meta-bar">
              <div className="event-organizer">
                <span>Organized by</span>
                <strong>{event.organizer?.name || 'Unknown Organizer'}</strong>
              </div>
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 size={16} /> Share Event
              </Button>
            </div>

            <div className="event-description">
              <h3>About this event</h3>
              <p>{event.description || 'No description provided.'}</p>
            </div>

            {event.tags && event.tags.length > 0 && (
              <div className="event-tags">
                {event.tags.map(tag => (
                  <span key={tag} className="event-tag">#{tag}</span>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column — Sticky Booking Card */}
        <div className="event-sidebar">
          <motion.div 
            className="booking-card glass-strong"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="booking-card-price">
              <h2>{formatPrice(event.ticket_price, event.currency)}</h2>
              <span>per ticket</span>
            </div>

            <div className="booking-card-info">
              <div className="info-item">
                <div className="info-icon"><Calendar size={20} /></div>
                <div className="info-text">
                  <strong>Date & Time</strong>
                  <span>{format(new Date(event.start_date), "EEEE, MMMM d, yyyy")}</span>
                  <span>{format(new Date(event.start_date), "h:mm a")}</span>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon"><MapPin size={20} /></div>
                <div className="info-text">
                  <strong>Location</strong>
                  <span>{event.venue_name}</span>
                  <span>{event.venue_city}, {event.venue_country}</span>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon"><Users size={20} /></div>
                <div className="info-text">
                  <strong>Availability</strong>
                  {isSoldOut ? (
                    <span className="text-danger font-bold">Sold Out!</span>
                  ) : (
                    <span>{availableTickets} tickets remaining</span>
                  )}
                </div>
              </div>
            </div>

            <div className="booking-card-action">
              <Button 
                size="lg" 
                fullWidth 
                disabled={isSoldOut || unavailable}
                onClick={handleBookClick}
              >
                {unavailable ? 'Booking Unavailable' : isSoldOut ? 'Sold Out' : 'Book Tickets Now'}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {showBookingModal && (
        <BookingModal
          event={event}
          user={user}
          onClose={() => { if (!bookingPending.current) setShowBookingModal(false); }}
          onBook={handleConfirmBooking}
          isProcessing={bookingProcessing}
        />
      )}
    </div>
  );
}
