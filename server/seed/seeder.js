const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const readConfig = require('../config/env');
const connectDB = require('../config/db');
const { createBooking } = require('../services/bookings');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const seedData = async () => {
  try {
    const config = readConfig();
    if (config.mode === 'production' || !process.argv.includes('--reset')) {
      throw new Error('Demo seeding deletes data. Use npm run seed -- --reset only with a disposable development database.');
    }
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Event.deleteMany({});
    await Booking.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create demo users
    const organizer = await User.create({
      name: 'Priya Sharma',
      email: 'organizer@eventhub.com',
      password: 'password123',
      role: 'organizer'
    });

    const attendee = await User.create({
      name: 'Rahul Patel',
      email: 'attendee@eventhub.com',
      password: 'password123',
      role: 'attendee'
    });

    console.log('👤 Created demo users');
    console.log('   Organizer: organizer@eventhub.com / password123');
    console.log('   Attendee:  attendee@eventhub.com / password123');

    // Create events
    const seedEvents = [
      {
        title: 'TechVista 2025 — India\'s Premier AI Summit',
        description: 'Join 2000+ tech leaders, AI researchers, and startup founders at India\'s largest artificial intelligence conference. Featuring keynotes from Google DeepMind, OpenAI, and top Indian AI startups. Workshops on LLMs, computer vision, and responsible AI. Networking dinner included.',
        event_type: 'conference',
        venue_name: 'Bangalore International Exhibition Centre',
        venue_address: 'Tumkur Road, Madavara Post',
        venue_city: 'Bangalore',
        venue_country: 'India',
        start_date: new Date('2025-08-15T09:00:00'),
        end_date: new Date('2025-08-17T18:00:00'),
        ticket_price: 4999,
        currency: 'INR',
        total_capacity: 2000,
        tickets_sold: 0,
        status: 'published',
        image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
        tags: ['AI', 'technology', 'startup', 'machine-learning'],
        featured: true,
        organizer: organizer._id
      },
      {
        title: 'Midnight Melodies — AR Rahman Live',
        description: 'Experience the magic of AR Rahman performing live with a 40-piece orchestra. A spectacular evening of Bollywood hits, Oscar-winning compositions, and Tamil classics under the stars. VIP passes include backstage meet & greet.',
        event_type: 'concert',
        venue_name: 'DY Patil Stadium',
        venue_address: 'Nerul, Navi Mumbai',
        venue_city: 'Mumbai',
        venue_country: 'India',
        start_date: new Date('2025-09-20T19:00:00'),
        end_date: new Date('2025-09-20T23:30:00'),
        ticket_price: 2499,
        currency: 'INR',
        total_capacity: 5000,
        tickets_sold: 0,
        status: 'published',
        image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
        tags: ['music', 'concert', 'AR-Rahman', 'live'],
        featured: true,
        organizer: organizer._id
      },
      {
        title: 'Startup India Pitch Night',
        description: 'Watch 20 of India\'s most promising early-stage startups pitch to a panel of top VCs including Sequoia India, Accel, and Matrix Partners. Networking cocktail hour with angel investors. Early-bird tickets include dinner.',
        event_type: 'networking',
        venue_name: 'The Lalit New Delhi',
        venue_address: 'Barakhamba Avenue, Connaught Place',
        venue_city: 'New Delhi',
        venue_country: 'India',
        start_date: new Date('2025-07-10T17:00:00'),
        end_date: new Date('2025-07-10T22:00:00'),
        ticket_price: 1999,
        currency: 'INR',
        total_capacity: 300,
        tickets_sold: 0,
        status: 'published',
        image_url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800',
        tags: ['startup', 'networking', 'VC', 'pitch'],
        featured: false,
        organizer: organizer._id
      },
      {
        title: 'Full Stack Web Development Bootcamp',
        description: 'Intensive 2-day hands-on workshop covering React, Node.js, MongoDB, and deployment. Build a complete project from scratch. Includes lunch, course materials, and certificate of completion. Limited to 50 seats for personalized attention.',
        event_type: 'workshop',
        venue_name: 'WeWork Galaxy',
        venue_address: '43, Residency Road, Ashok Nagar',
        venue_city: 'Bangalore',
        venue_country: 'India',
        start_date: new Date('2025-08-02T09:30:00'),
        end_date: new Date('2025-08-03T17:00:00'),
        ticket_price: 3499,
        currency: 'INR',
        total_capacity: 50,
        tickets_sold: 0,
        status: 'published',
        image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
        tags: ['coding', 'workshop', 'web-development', 'MERN'],
        featured: false,
        organizer: organizer._id
      },
      {
        title: 'Heritage Grand Gala 2025',
        description: 'An exquisite black-tie evening celebrating Indian art and culture. Live classical performances by Ustad Zakir Hussain\'s disciples, curated art exhibition, gourmet 7-course dinner with paired wines. Proceeds go to heritage conservation.',
        event_type: 'gala',
        venue_name: 'Taj Falaknuma Palace',
        venue_address: 'Engine Bowli, Falaknuma',
        venue_city: 'Hyderabad',
        venue_country: 'India',
        start_date: new Date('2025-10-05T18:00:00'),
        end_date: new Date('2025-10-05T23:59:00'),
        ticket_price: 15000,
        currency: 'INR',
        total_capacity: 200,
        tickets_sold: 0,
        status: 'published',
        image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
        tags: ['gala', 'culture', 'art', 'luxury'],
        featured: true,
        organizer: organizer._id
      },
      {
        title: 'Indian Premier Esports Championship',
        description: 'The biggest esports tournament in South Asia! Teams compete in Valorant, CS2, and BGMI for a ₹50 lakh prize pool. Live commentary, gaming zone with latest hardware, cosplay competition, and food court.',
        event_type: 'tournament',
        venue_name: 'HITEX Exhibition Center',
        venue_address: 'Izzathnagar, Kondapur',
        venue_city: 'Hyderabad',
        venue_country: 'India',
        start_date: new Date('2025-09-12T10:00:00'),
        end_date: new Date('2025-09-14T20:00:00'),
        ticket_price: 799,
        currency: 'INR',
        total_capacity: 3000,
        tickets_sold: 0,
        status: 'published',
        image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
        tags: ['esports', 'gaming', 'tournament', 'competition'],
        featured: false,
        organizer: organizer._id
      },
      {
        title: 'Cloud Architecture Masterclass',
        description: 'Deep dive into AWS and Azure cloud architecture with hands-on labs. Learn microservices, serverless, Kubernetes, and CI/CD pipelines. Taught by AWS Solutions Architects. Includes 3-month free cloud credits.',
        event_type: 'webinar',
        venue_name: 'Online — Zoom Webinar',
        venue_address: 'Virtual Event',
        venue_city: 'Online',
        venue_country: 'India',
        start_date: new Date('2025-07-25T10:00:00'),
        end_date: new Date('2025-07-25T16:00:00'),
        ticket_price: 999,
        currency: 'INR',
        total_capacity: 500,
        tickets_sold: 0,
        status: 'published',
        image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
        tags: ['cloud', 'AWS', 'Azure', 'DevOps'],
        featured: false,
        organizer: organizer._id
      },
      {
        title: 'India Design Week 2025',
        description: 'India\'s largest design exhibition featuring 100+ designers, architects, and artists. Interactive installations, design thinking workshops, typography masterclass, UX portfolio reviews, and startup design showcase.',
        event_type: 'exhibition',
        venue_name: 'Pragati Maidan',
        venue_address: 'Mathura Road',
        venue_city: 'New Delhi',
        venue_country: 'India',
        start_date: new Date('2025-11-08T10:00:00'),
        end_date: new Date('2025-11-10T18:00:00'),
        ticket_price: 1499,
        currency: 'INR',
        total_capacity: 1500,
        tickets_sold: 0,
        status: 'published',
        image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800',
        tags: ['design', 'art', 'exhibition', 'UX'],
        featured: false,
        organizer: organizer._id
      }
    ];
    const events = await Event.create(seedEvents.map((event, index) => {
      const duration = event.end_date - event.start_date;
      const start = new Date(Date.now() + (14 + index * 7) * 86400000);
      return { ...event, start_date: start, end_date: new Date(start.getTime() + duration) };
    }));

    console.log(`🎉 Created ${events.length} events`);

    // Create a sample booking
    const { booking } = await createBooking(attendee.id, {
      event: events[0].id,
      attendee_name: 'Rahul Patel',
      attendee_email: 'attendee@eventhub.com',
      attendee_phone: '+91 98765 43210',
      number_of_tickets: 2,
      special_requirements: 'Wheelchair accessible seating please'
    });

    console.log(`🎟️  Created sample booking: ${booking.booking_reference}`);
    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Demo Accounts:');
    console.log('   Organizer → organizer@eventhub.com / password123');
    console.log('   Attendee  → attendee@eventhub.com / password123');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Seeding failed:', error.message.startsWith('Demo seeding') ? error.message : 'Check configuration and the development database.');
    await mongoose.disconnect();
    process.exitCode = 1;
  }
};

seedData();
