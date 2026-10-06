import React from 'react';
import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BookingModal from './BookingModal';

const event = { _id: 'event-id', title: 'Workshop', total_capacity: 5, tickets_sold: 0, ticket_price: 10, currency: 'INR' };
const user = { name: 'Test User', email: 'user@test.example' };

test('retries the same booking with the same idempotency key', () => {
  const onBook = vi.fn();
  render(<BookingModal event={event} user={user} onClose={() => {}} onBook={onBook} isProcessing={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
  expect(onBook).toHaveBeenCalledTimes(2);
  expect(onBook.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/);
  expect(onBook.mock.calls[1][1]).toBe(onBook.mock.calls[0][1]);
});

test('processing disables submission and input changes', () => {
  const onBook = vi.fn();
  render(<BookingModal event={event} user={user} onClose={() => {}} onBook={onBook} isProcessing={true} />);
  expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
  expect(screen.getByLabelText('Number of Tickets *')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Processing...' }));
  expect(onBook).not.toHaveBeenCalled();
});

test('rejects fractional ticket quantities', () => {
  const onBook = vi.fn();
  const { container } = render(<BookingModal event={event} user={user} onClose={() => {}} onBook={onBook} isProcessing={false} />);
  fireEvent.change(screen.getByLabelText('Number of Tickets *'), { target: { value: '1.5' } });
  fireEvent.submit(container.querySelector('form'));
  expect(onBook).not.toHaveBeenCalled();
  expect(screen.getByText('Enter a positive whole number of tickets')).toBeInTheDocument();
});
