import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  `${process.env.EXPO_PUBLIC_BASE_URL}/api`;

interface OrderLineItem {
  coupon_id: number;
  title: string;
  thumbnail_url?: string | null;
  quantity: number;
  price: number | null;
  subtotal: number | null;
}

interface Order {
  id: string;
  user_id: number;
  customer: string;
  customer_email?: string | null;
  vendor_name?: string | null;
  items: OrderLineItem[];
  total_items: number;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  transaction_id?: string;
  payment_details?: {
    card_brand?: string;
    card_last4?: string;
    customer_email?: string;
    customer_name?: string;
    receipt_url?: string;
    amount_total?: number;
  };
  created_at: string;
}

const COLORS = {
  primary: '#FF5500',
  darkBg: '#111827',
  cardBg: '#FFFFFF',
  textDark: '#1F2937',
  textMuted: '#6B7280',
  greenSuccess: '#10B981',
  yellowPending: '#F59E0B',
  redInactive: '#EF4444',
  border: '#E5E7EB',
  blueInfo: '#3B82F6',
};

const STATUS_TABS = ['All Orders', 'Placed', 'Paid', 'Pending', 'Cancelled'];

const statusBadge = (status: string, payment: string) => {
  if (status === 'cancelled')
    return { bg: '#FDE8E8', text: '#9B1C1C', label: 'Cancelled' };
  if (payment === 'paid')
    return { bg: '#DEF7EC', text: '#03543F', label: 'Paid' };
  if (payment === 'pending')
    return { bg: '#FEF3C7', text: '#92400E', label: 'Payment pending' };
  return { bg: '#E0F2FE', text: '#0369A1', label: 'Placed' };
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  return {
    date: d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

export default function OrdersScreen() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All Orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [selectedOrderForActions, setSelectedOrderForActions] =
    useState<Order | null>(null);

  // ---- FETCH ALL ORDERS (no auth) ----
  const fetchOrders = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/orders`, {
        headers: { Accept: 'application/json' },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.status !== 'success') {
        throw new Error(json?.message || `Request failed (${res.status})`);
      }

      setOrders(json.data.orders ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // ---- DERIVED ----
  const stats = useMemo(
    () => ({
      total: orders.length,
      placed: orders.filter((o) => o.status === 'placed').length,
      paid: orders.filter((o) => o.payment_status === 'paid').length,
      pending: orders.filter((o) => o.payment_status === 'pending').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
    }),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    let list = orders;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer?.toLowerCase().includes(q) ||
          o.customer_email?.toLowerCase().includes(q) ||
          o.items.some((it) => it.title?.toLowerCase().includes(q))
      );
    }

    if (activeTab === 'Placed') list = list.filter((o) => o.status === 'placed');
    if (activeTab === 'Paid') list = list.filter((o) => o.payment_status === 'paid');
    if (activeTab === 'Pending') list = list.filter((o) => o.payment_status === 'pending');
    if (activeTab === 'Cancelled') list = list.filter((o) => o.status === 'cancelled');

    return list;
  }, [orders, search, activeTab]);

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setViewModalVisible(true);
  };

  const handleActionsPress = (order: Order) => {
    setSelectedOrderForActions(order);
    setActionsModalVisible(true);
  };

  const tabKey = (tab: string) => (tab === 'All Orders' ? 'All' : tab);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />

      <View style={styles.header}>
        <Image
          source={require('@/assets/images/Roameo-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity>
          <Ionicons name="person-circle-outline" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <Text style={styles.pageTitle}>Orders</Text>
        <Text style={styles.pageSubtitle}>
          Monitor and manage all platform orders.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabContent}>
          {STATUS_TABS.map((tab) => {
            const key = tabKey(tab);
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(key)}
                style={[
                  styles.tabButton,
                  activeTab === key && styles.tabButtonActive,
                ]}>
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === key && styles.tabButtonTextActive,
                  ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.statsRow}>
          <Text style={styles.statsTitle}>Orders</Text>
          <View style={styles.statsValues}>
            <Stat label="All" value={stats.total} />
            <Stat label="Placed" value={stats.placed} color={COLORS.blueInfo} />
            <Stat label="Paid" value={stats.paid} color={COLORS.greenSuccess} />
            <Stat label="Pending" value={stats.pending} color={COLORS.yellowPending} />
            <Stat label="Cancelled" value={stats.cancelled} color={COLORS.redInactive} />
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            placeholder="Search by order ID, customer, or item..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor={COLORS.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.emptyText}>Loading orders…</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={32} color={COLORS.redInactive} />
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchOrders}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="folder-open-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {filteredOrders.map((item) => {
              const badge = statusBadge(item.status, item.payment_status);
              const { date, time } = formatDate(item.created_at);
              const primary = item.items[0];

              return (
                <View key={item.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderId}>#{item.id}</Text>
                    <TouchableOpacity onPress={() => handleActionsPress(item)}>
                      <Ionicons
                        name="ellipsis-vertical"
                        size={20}
                        color={COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.categoryPill, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.categoryText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>

                  <Text style={styles.orderTitle}>
                    {primary?.title ?? 'Order'}
                    {item.items.length > 1 ? ` +${item.items.length - 1} more` : ''}
                  </Text>

                  <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.infoText}>Customer: {item.customer_name || 'Unknown'}</Text>
                  </View>
                  <View style={[styles.infoRow, { marginTop: 4 }]}>
                    <Ionicons name="storefront-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.infoText}>Vendor: {item.vendor_name || 'Unknown'}</Text>
                  </View>

                  <View style={styles.dateTimeRow}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.infoText}>{date}</Text>
                    {time ? (
                      <>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={COLORS.textMuted}
                          style={styles.timeIcon}
                        />
                        <Text style={styles.infoText}>{time}</Text>
                      </>
                    ) : null}
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>
                      {item.currency} {Number(item.total_amount).toFixed(2)}
                    </Text>
                    <Text style={styles.itemsText}>
                      {item.total_items} item{item.total_items === 1 ? '' : 's'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewOrder(item)}>
                    <Text style={styles.viewButtonText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Actions Modal */}
      <Modal
        visible={actionsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsModalVisible(false)}>
        <TouchableOpacity
          style={styles.actionsOverlay}
          activeOpacity={1}
          onPress={() => setActionsModalVisible(false)}>
          <View style={styles.actionsModal}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (selectedOrderForActions) {
                  handleViewOrder(selectedOrderForActions);
                  setActionsModalVisible(false);
                }
              }}>
              <Ionicons name="eye-outline" size={20} color={COLORS.textDark} />
              <Text style={styles.actionText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Details Modal */}
      <Modal
        visible={viewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setViewModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView>
                <View style={styles.modalBody}>
                  <Text style={styles.modalOrderId}>#{selectedOrder.id}</Text>

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="person-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.modalInfoText}>
                      Customer: {selectedOrder.customer_name || 'Unknown'}
                      {selectedOrder.customer_email
                        ? ` (${selectedOrder.customer_email})`
                        : ''}
                    </Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="storefront-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.modalInfoText}>
                      Vendor: {selectedOrder.vendor_name || 'Unknown'}
                    </Text>
                  </View>

                  {selectedOrder.items.map((it) => (
                    <View key={it.coupon_id} style={styles.lineItem}>
                      <Text style={styles.lineTitle}>{it.title}</Text>
                      <Text style={styles.lineMeta}>
                        {it.quantity} ×{' '}
                        {it.price == null
                          ? '—'
                          : `${selectedOrder.currency} ${it.price.toFixed(2)}`}
                      </Text>
                      <Text style={styles.lineSubtotal}>
                        Subtotal:{' '}
                        {it.subtotal == null
                          ? '—'
                          : `${selectedOrder.currency} ${it.subtotal.toFixed(2)}`}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.modalPriceText}>
                      Total: {selectedOrder.currency}{' '}
                      {Number(selectedOrder.total_amount).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.modalInfoText}>
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.modalStatusRow}>
                    <View
                      style={[
                        styles.modalStatusBadge,
                        {
                          backgroundColor: statusBadge(
                            selectedOrder.status,
                            selectedOrder.payment_status
                          ).bg,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.modalStatusText,
                          {
                            color: statusBadge(
                              selectedOrder.status,
                              selectedOrder.payment_status
                            ).text,
                          },
                        ]}>
                        {statusBadge(selectedOrder.status, selectedOrder.payment_status).label}
                      </Text>
                    </View>
                  </View>

                  {/* Payment Information */}
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 }}>
                      Payment Information
                    </Text>
                    <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                      Status: <Text style={{ fontWeight: '600', color: selectedOrder.payment_status === 'paid' ? COLORS.greenSuccess : COLORS.yellowPending }}>{selectedOrder.payment_status?.toUpperCase()}</Text>
                    </Text>
                    {selectedOrder.payment_method && (
                      <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                        Method: <Text style={{ fontWeight: '600', color: COLORS.textDark }}>{selectedOrder.payment_method} {selectedOrder.payment_details?.card_last4 ? `(•••• ${selectedOrder.payment_details.card_last4})` : ''}</Text>
                      </Text>
                    )}
                    {selectedOrder.transaction_id && (
                      <Text selectable style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                        Transaction ID: {selectedOrder.transaction_id}
                      </Text>
                    )}
                    {selectedOrder.customer_email && (
                      <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                        Customer Email: {selectedOrder.customer_email}
                      </Text>
                    )}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statNumber, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    height: 56,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logo: { width: 100, height: 32 },
  scrollContent: { padding: 16, paddingBottom: 80 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textDark, marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 16 },
  tabScroll: { marginBottom: 16 },
  tabContent: { gap: 8 },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabButtonText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  tabButtonTextActive: { color: '#FFF', fontWeight: '600' },
  statsRow: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textDark, marginBottom: 8 },
  statsValues: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: COLORS.textDark },
  statLabel: { fontSize: 10, color: COLORS.textMuted },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 16,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.textDark },
  ordersList: { gap: 12 },
  orderCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: { fontSize: 14, fontWeight: 'bold', color: COLORS.textDark },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 6,
    marginTop: 6,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryText: { fontSize: 12, fontWeight: '500' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoText: { fontSize: 13, color: COLORS.textDark },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  timeIcon: { marginLeft: 8 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textDark },
  itemsText: { fontSize: 13, color: COLORS.textMuted },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 4,
  },
  viewButtonText: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },
  emptyCard: {
    backgroundColor: COLORS.cardBg,
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryText: { color: '#FFF', fontWeight: '600' },
  actionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsModal: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 8,
    width: '80%',
    maxWidth: 300,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderRadius: 8,
  },
  actionText: { fontSize: 16, color: COLORS.textDark },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textDark },
  modalBody: { gap: 12 },
  modalOrderId: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: '#FFF0EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  lineItem: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  lineTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textDark },
  lineMeta: { fontSize: 12, color: COLORS.textMuted },
  lineSubtotal: { fontSize: 12, color: COLORS.textDark, marginTop: 2 },
  modalInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalInfoText: { fontSize: 14, color: COLORS.textDark, flex: 1 },
  modalPriceText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, flex: 1 },
  modalStatusRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalStatusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  modalStatusText: { fontSize: 12, fontWeight: '600' },
});