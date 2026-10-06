import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Filter } from 'lucide-react';
import { eventsAPI } from '../services/api';
import EventCard from '../Components/Events/EventCard';
import Button from '../Components/ui/Button';
import './Landing.css';

export default function Landing() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    city: 'all'
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    eventsAPI.getAll({ ...appliedFilters, page }, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      setEvents(previous => page === 1 ? data.events : [...previous, ...data.events]);
      setPages(data.pages);
      setTotal(data.total);
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Unable to load events. Please try again.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [appliedFilters, page, retry]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setEvents([]);
    setAppliedFilters({ ...filters });
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Discover Incredible <span className="text-gradient-hero">Events</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Book tickets to the best concerts, tech conferences, workshops, and exclusive networking events near you.
          </motion.p>
        </div>

        {/* Search Bar */}
        <motion.div
          className="search-bar glass-strong"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder="Search events or topics..."
                aria-label="Search events"
                maxLength={120}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="search-input"
              />
            </div>
            
            <div className="search-filters">
              <div className="search-filter">
                <MapPin size={16} />
                <select aria-label="City"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                >
                  <option value="all">All Cities</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="New Delhi">New Delhi</option>
                  <option value="Hyderabad">Hyderabad</option>
                </select>
              </div>
              
              <div className="search-filter">
                <Filter size={16} />
                <select aria-label="Event type"
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                >
                  <option value="all">All Types</option>
                  <option value="conference">Conferences</option>
                  <option value="concert">Concerts</option>
                  <option value="workshop">Workshops</option>
                  <option value="networking">Networking</option>
                  <option value="tournament">Esports</option>
                </select>
              </div>
            </div>

            <Button type="submit" size="lg" className="search-btn">
              Find Events
            </Button>
          </form>
        </motion.div>
      </section>

      {/* Results Section */}
      <section className="events-section">
        <div className="section-header">
          <h2>
            {appliedFilters.search || appliedFilters.type !== 'all' || appliedFilters.city !== 'all' 
              ? 'Search Results' 
              : 'Trending Events'}
          </h2>
          {events.length > 0 && <span className="events-count">{total} events found</span>}
        </div>

        {loadError ? (
          <div role="alert" className="empty-state glass">
            <p>{loadError}</p>
            <Button onClick={() => setRetry(value => value + 1)}>Try Again</Button>
          </div>
        ) : loading && events.length === 0 ? (
          <div className="page-loader">
            <div className="spinner spinner-dark"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state glass">
            <div className="empty-state-icon">
              <Search size={48} />
            </div>
            <h3>No events found</h3>
            <p>Try adjusting your filters or search terms.</p>
            <Button variant="outline" onClick={() => {
              setPage(1);
              setEvents([]);
              setFilters({ search: '', type: 'all', city: 'all' });
              setAppliedFilters({ search: '', type: 'all', city: 'all' });
            }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid-events">
            {events.map((event, index) => (
              <EventCard 
                key={event._id} 
                event={event} 
                featured={event.featured}
                index={index}
              />
            ))}
          </div>
        )}
        {!loadError && page < pages && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Button onClick={() => setPage(value => value + 1)} loading={loading}>Load More Events</Button>
          </div>
        )}
      </section>
    </div>
  );
}
