export interface Vendor {
  id: number;
  name: string;
  approval_status: string;
  created_at: string;
}

export interface Ad {
  id: number;
  is_active: boolean | number | string;
}

export interface Category {
  id: number;
  category_name: string;
  sub_divisions?: Category[];
}

// ---------- Orders (matches /api/admin/orders response) ----------
export interface DashboardOrderItem {
  coupon_id: number | string;
  title: string;
  thumbnail_url?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface DashboardOrder {
  id: string | number;
  user_id?: number | string;
  customer?: string;
  customer_email?: string;
  items: DashboardOrderItem[];
  total_items: number;
  total: number;              // normalized from total_amount
  currency?: string;
  status: string;
  payment_status?: string;
  created_at: string;
  title?: string;             // derived from first item for display
}

export function parseOrders(payload: unknown): DashboardOrder[] {
  const raw =
    (payload as any)?.data?.orders ??
    (payload as any)?.orders ??
    payload;
  if (!Array.isArray(raw)) throw new Error('Invalid orders response');
  return raw.map((o: any): DashboardOrder => ({
    id: o.id,
    user_id: o.user_id,
    customer: o.customer,
    customer_email: o.customer_email,
    items: Array.isArray(o.items) ? o.items : [],
    total_items: Number(o.total_items ?? 0),
    total: Number(o.total_amount ?? o.total ?? 0),
    currency: o.currency,
    status: o.status ?? 'unknown',
    payment_status: o.payment_status,
    created_at: o.created_at,
    title: o.items?.[0]?.title ?? `Order #${o.id}`,
  }));
}

export function summarizeOrders(orders: DashboardOrder[], categories: Category[], now = new Date()) {
  const weekly = summarizeVendors(
    orders.map(order => ({ id: 0, name: '', approval_status: '', created_at: order.created_at })),
    now
  );

  const categoryNames = new Map<number, string>();
  const collect = (items: Category[]) =>
    items.forEach(category => {
      categoryNames.set(category.id, category.category_name);
      if (Array.isArray(category.sub_divisions)) collect(category.sub_divisions);
    });
  collect(categories);

  const counts = new Map<string, number>();
  orders.forEach(order => {
    const key = String((order as any).category_id ?? (order as any).category ?? 'Uncategorized');
    const name = categoryNames.get(Number(key)) || (order as any).category || 'Uncategorized';
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const shares = sorted.slice(0, 4).map(([name, count]) => ({ name, count }));
  if (sorted.length > 4)
    shares.push({ name: 'Others', count: sorted.slice(4).reduce((sum, [, count]) => sum + count, 0) });

  const revenueOrders = orders.filter(order =>
    ['paid', 'completed'].includes(order.status.toLowerCase())
  );
  const currencies = new Set(revenueOrders.map(order => order.currency || ''));

  return {
    thisWeek: weekly.thisWeek,
    lastWeek: weekly.lastWeek,
    // Count only paid/completed orders; do not present pending order value as revenue.
    revenue:
      currencies.size <= 1
        ? revenueOrders.reduce((sum, order) => sum + order.total, 0)
        : null,
    currency: currencies.size === 1 ? [...currencies][0] : undefined,
    categories: shares,
    recent: [...orders]
      .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
      .slice(0, 5),
  };
}

export interface CouponStats {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  expired: number;
}

export async function fetchDashboardResource(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api${path}`, { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const body = await response.json();
  if (body.status !== 'success') throw new Error('Unable to load data');
  return body.data;
}

export function parseArray<T>(data: unknown): T[] {
  if (!Array.isArray(data)) throw new Error('Invalid response');
  return data;
}

export function parseCouponStats(data: unknown): CouponStats {
  if (!data || typeof data !== 'object') throw new Error('Invalid coupon statistics');
  const result = {} as CouponStats;
  for (const key of ['total', 'active', 'pending', 'inactive', 'expired'] as const) {
    const value = (data as Record<string, unknown>)[key];
    if (
      (typeof value !== 'number' && typeof value !== 'string') ||
      value === '' ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0
    ) {
      throw new Error('Invalid coupon statistics');
    }
    result[key] = Number(value);
  }
  return result;
}

export function countCategories(categories: Category[]): number {
  const ids = new Set<number>();
  const visit = (items: Category[]) =>
    items.forEach(item => {
      if (ids.has(item.id)) return;
      ids.add(item.id);
      if (Array.isArray(item.sub_divisions)) visit(item.sub_divisions);
    });
  visit(categories);
  return ids.size;
}

export function summarizeVendors(vendors: Vendor[], now = new Date()) {
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const countDay = (offset: number) => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return vendors.filter(vendor => {
      const time = Date.parse(vendor.created_at);
      return time >= start.getTime() && time < end.getTime() && time <= now.getTime();
    }).length;
  };

  const thisWeek = Array.from({ length: now.getDay() + 1 }, (_, day) => countDay(day));
  const lastWeek = Array.from({ length: 7 }, (_, day) => countDay(day - 7));

  const statusCounts = new Map<string, number>();
  vendors.forEach(vendor => {
    const status = vendor.approval_status?.toLowerCase() || 'unknown';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });

  return {
    thisWeek,
    lastWeek,
    statuses: [...statusCounts].map(([name, count]) => ({ name, count })),
    pending: statusCounts.get('pending') || 0,
    recent: [...vendors]
      .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
      .slice(0, 5),
  };
}