import type { DashboardOrder } from './dashboard';

// Original demo orders, shared by the Orders screen and dashboard until the
// real orders API is connected.
export const SAMPLE_ORDERS = [
  { id: 'ORD-2025-0101', title: 'Front AI: Edifice Role', category: 'Kubernetes', customer: 'James Brown', date: '14 May 2025', time: '10:00 AM', created_at: '2025-05-14T10:00:00', vendor: 'Sky Adventures', total: 250, items: 1, status: 'pending', currency: 'USD' },
  { id: 'ORD-2025-0102', title: 'Aroma Relaxation Massage', category: 'Spa & Wellness', customer: 'Olivia Smith', date: '28 May 2025', time: '10:00 AM', created_at: '2025-05-28T10:00:00', vendor: 'Bliss Spa', total: 90, items: 1, status: 'confirmed', currency: 'USD' },
  { id: 'ORD-2025-0103', title: 'Quantum Dinner Experience', category: 'Food & Drinks', customer: 'Sarah Lee', date: '17 May 2025', time: '6:00 PM', created_at: '2025-05-17T18:00:00', vendor: 'The Gourmet Hub', total: 120, items: 2, status: 'completed', currency: 'USD' },
  { id: 'ORD-2025-0104', title: 'Sunset Yoga Session', category: 'Fitness', customer: 'Frida Smith', date: '24 May 2025', time: '6:00 PM', created_at: '2025-05-24T18:00:00', vendor: "Frida's Studio", total: 40, items: 1, status: 'cancelled', currency: 'USD' },
  { id: 'ORD-2025-0105', title: 'City Lights Tour', category: 'Travel', customer: 'Michael Chen', date: '20 May 2025', time: '8:00 PM', created_at: '2025-05-20T20:00:00', vendor: 'Night Tours Co', total: 180, items: 2, status: 'confirmed', currency: 'USD' },
  { id: 'ORD-2025-0106', title: 'Premium Wine Tasting', category: 'Food & Drinks', customer: 'Emma Wilson', date: '22 May 2025', time: '5:00 PM', created_at: '2025-05-22T17:00:00', vendor: 'Vineyard Estates', total: 75, items: 1, status: 'pending', currency: 'USD' },
  { id: 'ORD-2025-0107', title: 'Adventure Paintball', category: 'Adventure', customer: 'David Park', date: '25 May 2025', time: '2:00 PM', created_at: '2025-05-25T14:00:00', vendor: 'Extreme Sports', total: 200, items: 3, status: 'completed', currency: 'USD' },
  { id: 'ORD-2025-0108', title: 'Artisan Coffee Workshop', category: 'Coffee & Tea', customer: 'Lisa Martinez', date: '30 May 2025', time: '9:30 AM', created_at: '2025-05-30T09:30:00', vendor: 'Brew Masters', total: 45, items: 1, status: 'confirmed', currency: 'USD' },
] satisfies (DashboardOrder & { date: string; time: string; status: 'pending' | 'confirmed' | 'completed' | 'cancelled' })[];
