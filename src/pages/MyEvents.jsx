import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, PlusCircle } from 'lucide-react';
import { useToast } from '../Components/ui/Toast';
import EventCard from '../Components/Events/EventCard';
import Button from '../Components/ui/Button';
import { eventsAPI } from '../services/api';

export default function MyEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [pendingId, setPendingId] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchMyEvents();
    // eslint-disable-next-line
  }, []);

  const fetchMyEvents = async () => {
    try {
      const data = await eventsAPI.getMyEvents();
      setEvents(data.events);
      setLoadError('');
    } catch (error) {
      setLoadError('Unable to load your events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const changeEvent = async (event, action) => {
    const message = action === 'cancel' ? 'Cancel this event? Attendees will see that it has been cancelled.' : 'Delete this event? Events with booking history cannot be deleted.';
    if (!window.confirm(message)) return;
    setPendingId(event._id);
    try {
      if (action === 'cancel') await eventsAPI.update(event._id, { status: 'cancelled' });
      else await eventsAPI.delete(event._id);
      toast.success(action === 'cancel' ? 'Event cancelled' : 'Event deleted');
      await fetchMyEvents();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPendingId(null);
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

        {loadError ? (
          <div role="alert" className="empty-state glass"><p>{loadError}</p><Button onClick={fetchMyEvents}>Try Again</Button></div>
        ) : loading ? (
          <div className="page-loader">
            <div className="spinner spinner-dark"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state glass">
            <div className="empty-state-icon">
              <Calendar size={48} />
            </div>
            <h3>No events created yet</h3>
            <p>Start hosting events and selling tickets on Lumina.</p>
            <Link to="/create-event">
              <Button size="lg">Create Your First Event</Button>
            </Link>
          </div>
        ) : (
          <div className="grid-events">
            {events.map((event, index) => (
              <div key={event._id}>
              <EventCard
                key={event._id} 
                event={event} 
                index={index}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                {['draft', 'published'].includes(event.status) && <Button variant="outline" size="sm" disabled={pendingId !== null} onClick={() => changeEvent(event, 'cancel')}>Cancel Event</Button>}
                <Button variant="danger" size="sm" disabled={pendingId !== null} onClick={() => changeEvent(event, 'delete')}>Delete Event</Button>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
