import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyBookings from './MyBookings';
import { bookingsAPI } from '../services/api';

vi.mock('../services/api', () => ({ bookingsAPI: { getMy: vi.fn(), cancel: vi.fn() } }));
vi.mock('../Components/ui/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
beforeEach(() => vi.clearAllMocks());

test('missing legacy event records do not crash booking history', async () => {
  bookingsAPI.getMy.mockResolvedValue({ bookings: [{ _id: 'b', event: null, booking_status: 'confirmed', total_amount: 10, booking_reference: 'TEST', number_of_tickets: 1 }] });
  render(<MemoryRouter><MyBookings /></MemoryRouter>);
  expect(await screen.findByText('Event details unavailable')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
});

test('event snapshots preserve history when an event is missing', async () => {
  bookingsAPI.getMy.mockResolvedValue({ bookings: [{ _id: 'b', event: null, event_snapshot: { title: 'Original Workshop', start_date: '2030-01-01T10:00:00Z', venue_name: 'Hall', venue_city: 'City', currency: 'INR' }, booking_status: 'cancelled', total_amount: 10, booking_reference: 'TEST', number_of_tickets: 1 }] });
  render(<MemoryRouter><MyBookings /></MemoryRouter>);
  expect(await screen.findByText('Original Workshop')).toBeInTheDocument();
});
