import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatPrice, getTypeClass, capitalizeFirst } from '../../utils/helpers';
import './EventCard.css';

export default function EventCard({ event, featured = false, index = 0 }) {
  const availableTickets = event.total_capacity - event.tickets_sold;
  const isSoldOut = availableTickets <= 0;
  const unavailable = event.status !== 'published' || new Date(event.start_date) <= new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link to={`/events/${event._id}`} className="event-card-link">
        <div className={`event-card ${featured ? 'event-card-featured' : ''}`}>
          <div className="event-card-image">
            {event.image_url ? (
              <img src={event.image_url} alt={event.title} />
            ) : (
              <div className="event-card-image-placeholder">
                <Calendar size={48} strokeWidth={1} />
              </div>
            )}
            {featured && (
              <div className="event-card-featured-badge">
                <Sparkles size={14} />
                <span>Featured</span>
              </div>
            )}
            {isSoldOut && (
              <div className="event-card-soldout-overlay">
                <span>SOLD OUT</span>
              </div>
            )}
          </div>

          <div className="event-card-body">
            <div className="event-card-top">
              <Badge className={getTypeClass(event.event_type)}>
                {capitalizeFirst(event.event_type)}
              </Badge>
              {event.status !== 'published' && <Badge className="status-cancelled">{capitalizeFirst(event.status)}</Badge>}
              {!isSoldOut && availableTickets < 20 && (
                <Badge className="status-cancelled">
                  Only {availableTickets} left
                </Badge>
              )}
            </div>

            <h3 className="event-card-title">{event.title}</h3>

            {event.description && (
              <p className="event-card-desc">{event.description}</p>
            )}

            <div className="event-card-details">
              <div className="event-card-detail">
                <Calendar size={15} />
                <span>{format(new Date(event.start_date), "MMM d, yyyy 'at' h:mm a")}</span>
              </div>
              <div className="event-card-detail">
                <MapPin size={15} />
                <span>{event.venue_name}, {event.venue_city}</span>
              </div>
              <div className="event-card-detail">
                <Users size={15} />
                <span>{event.tickets_sold} / {event.total_capacity} attendees</span>
              </div>
            </div>

            <div className="event-card-footer">
              <span className="event-card-price">
                {formatPrice(event.ticket_price, event.currency)}
              </span>
              <Button
                variant={isSoldOut ? 'ghost' : 'primary'}
                size="sm"
                disabled={isSoldOut || unavailable}
              >
                {unavailable ? 'View Event' : isSoldOut ? 'Sold Out' : 'Book Now'}
              </Button>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
