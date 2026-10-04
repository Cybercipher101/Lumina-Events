import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, PlusCircle } from 'lucide-react';
import { eventsAPI } from '../services/api';
import { useToast } from '../Components/ui/Toast';
import EventCard from '../Components/Events/EventCard';
import Button from '../Components/ui/Button';

export default function MyEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchMyEvents();
    // eslint-disable-next-line
  }, []);

  const fetchMyEvents = async () => {
    try {
      const data = await eventsAPI.getMyEvents();
      setEvents(data.events);
    } catch (error) {
      toast.error('Failed to load your events');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="section-header">
          <div>
            <h2>My Hosted Events</h2>
            <span className="events-count">{events.length} Events</span>
          </div>
          <Link to="/create-event">
            <Button>
              <PlusCircle size={18} /> Create New Event
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="page-loader">
            <div className="spinner spinner-dark"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state glass">
            <div className="empty-state-icon">
              <Calendar size={48} />
            </div>
            <h3>No events created yet</h3>
            <p>Start hosting events and selling tickets on EventHub.</p>
            <Link to="/create-event">
              <Button size="lg">Create Your First Event</Button>
            </Link>
          </div>
        ) : (
          <div className="grid-events">
            {events.map((event, index) => (
              <EventCard 
                key={event._id} 
                event={event} 
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
