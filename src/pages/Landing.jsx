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
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    city: 'all'
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line
  }, [appliedFilters]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.getAll(appliedFilters);
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch events', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
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
                placeholder="Search events, organizers, or topics..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="search-input"
              />
            </div>
            
            <div className="search-filters">
              <div className="search-filter">
                <MapPin size={16} />
                <select 
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
                <select 
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
          {events.length > 0 && <span className="events-count">{events.length} events found</span>}
        </div>

        {loading ? (
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
      </section>
    </div>
  );
}
