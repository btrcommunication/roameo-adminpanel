import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `${process.env.EXPO_PUBLIC_BASE_URL}/api`;

const fetchWithCors = async (url: string, options: RequestInit = {}) => {
    const defaultHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        });
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
};

type TimeFilter = 'all' | 'month' | 'week' | 'today';

const COLORS = {
  primary: '#FF5500',
  darkBg: '#111827',
  cardBg: '#FFFFFF',
  textDark: '#1F2937',
  textMuted: '#6B7280',
  border: '#E5E7EB',
};

export default function AdminRevenueScreen() {
    const [orders, setOrders] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    useEffect(() => {
        fetchVendors();
    }, []);

    useEffect(() => {
        fetchOrders(selectedVendorFilter);
    }, [selectedVendorFilter]);

    const fetchVendors = async () => {
        try {
            const url = `${API_BASE_URL}/vendorcreation`;
            const response = await fetchWithCors(url);
            const result = await response.json();
            if (result.status === 'success' && result.data) {
                setVendors(result.data);
            }
        } catch (error) {
            console.error('Error fetching vendors:', error);
        }
    };

    const fetchOrders = async (vendorId: string) => {
        try {
            setLoading(true);
            const query = vendorId && vendorId !== 'all' ? `?vendor_id=${vendorId}` : '';
            const url = `${API_BASE_URL}/admin/orders${query}`;
            const response = await fetchWithCors(url);
            const data = await response.json();
            if (data.status === 'success' && data.data && data.data.orders) {
                setOrders(data.data.orders);
            }
        } catch (e) {
            console.error('Failed to fetch admin orders for revenue:', e);
        } finally {
            setLoading(false);
        }
    };
    
    const getCommissionRate = (tier: string) => {
        switch (tier?.toLowerCase()) {
            case 'gold': return 0.08;
            case 'silver': return 0.05;
            case 'bronze':
            case 'free':
            default: return 0.00;
        }
    };

    const filterByTime = (orderList: any[], filter: TimeFilter) => {
        const now = new Date();
        return orderList.filter((order) => {
            const orderDate = new Date(order.created_at);
            if (filter === 'today') {
                return orderDate.toDateString() === now.toDateString();
            } else if (filter === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 7);
                return orderDate >= weekAgo;
            } else if (filter === 'month') {
                return (
                    orderDate.getMonth() === now.getMonth() &&
                    orderDate.getFullYear() === now.getFullYear()
                );
            }
            return true;
        });
    };

    const timeFilteredOrders = filterByTime(orders, timeFilter);

    const displayedOrders = timeFilteredOrders.filter((order) => {
        const firstTitle = order.items && order.items[0] ? order.items[0].title : '';
        const customer = order.customer_name || '';
        const idStr = String(order.id);
        const query = searchQuery.toLowerCase();
        return (
            idStr.includes(query) ||
            firstTitle.toLowerCase().includes(query) ||
            customer.toLowerCase().includes(query)
        );
    });

    // Financial calculations based on each vendor's tier
    let totalGrossRevenue = 0;
    let totalCommission = 0;
    
    timeFilteredOrders.forEach(ord => {
        const gross = Number(ord.total_amount) || 0;
        const vendorData = vendors.find(v => String(v.id) === String(ord.vendor_id));
        const tier = vendorData?.tier_status || vendorData?.membership_tier || 'Bronze';
        const rate = getCommissionRate(tier);
        
        totalGrossRevenue += gross;
        totalCommission += (gross * rate);
    });
    
    const netPayout = totalGrossRevenue - totalCommission;
    const totalOrdersCount = timeFilteredOrders.length;
    const avgOrderValue = totalOrdersCount > 0 ? totalGrossRevenue / totalOrdersCount : 0;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.pageHeader}>
                    <View>
                        <Text style={styles.pageTitle}>Admin Revenue Analytics</Text>
                        <Text style={styles.pageSubtitle}>Track vendor sales and platform commissions</Text>
                    </View>
                    <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchOrders(selectedVendorFilter)}>
                        <Ionicons name="refresh" size={18} color="#FF6B00" />
                    </TouchableOpacity>
                </View>

                {/* Vendor Picker Dropdown */}
                <View style={{ zIndex: 100, marginBottom: 16 }}>
                    <TouchableOpacity
                        style={styles.vendorPickerBox}
                        onPress={() => setShowVendorDropdown(prev => !prev)}
                        activeOpacity={0.8}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="business" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={{ fontSize: 13, color: COLORS.textDark, flex: 1 }} numberOfLines={1}>
                                {selectedVendorFilter === 'all'
                                    ? '🏢 All Vendors (Platform Wide)'
                                    : (vendors.find(v => String(v.id) === selectedVendorFilter)?.business_name ||
                                        vendors.find(v => String(v.id) === selectedVendorFilter)?.owner_name ||
                                        `Vendor #${selectedVendorFilter}`)}
                            </Text>
                        </View>
                        <Ionicons name={showVendorDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>

                    {showVendorDropdown && (
                        <>
                            <TouchableOpacity
                                style={{ position: 'absolute', top: 48, left: -1000, right: -1000, bottom: -2000, zIndex: 98 }}
                                onPress={() => setShowVendorDropdown(false)}
                                activeOpacity={1}
                            />
                            <View style={styles.dropdownContainer}>
                                <ScrollView showsVerticalScrollIndicator nestedScrollEnabled>
                                    {[
                                        { id: 'all', label: '🏢 All Vendors (Platform Wide)' },
                                        ...vendors.map(v => ({
                                            id: String(v.id),
                                            label: v.business_name || v.owner_name || `Vendor #${v.id}`
                                        }))
                                    ].map((opt) => (
                                        <TouchableOpacity
                                            key={opt.id}
                                            style={[
                                                styles.dropdownItem,
                                                selectedVendorFilter === opt.id && styles.dropdownItemActive
                                            ]}
                                            onPress={() => {
                                                setSelectedVendorFilter(opt.id);
                                                setShowVendorDropdown(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.dropdownItemText,
                                                selectedVendorFilter === opt.id && styles.dropdownItemTextActive
                                            ]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </>
                    )}
                </View>

                {/* Time Filters */}
                <View style={styles.filterRow}>
                    {(['all', 'month', 'week', 'today'] as TimeFilter[]).map((f) => {
                        const labelMap: Record<TimeFilter, string> = {
                            all: 'All Time',
                            month: 'This Month',
                            week: 'This Week',
                            today: 'Today',
                        };
                        const active = timeFilter === f;
                        return (
                            <TouchableOpacity
                                key={f}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => setTimeFilter(f)}
                            >
                                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                    {labelMap[f]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Metrics Grid */}
                <View style={styles.metricsGrid}>
                    <View style={[styles.metricCard, { borderLeftColor: '#10B981', borderLeftWidth: 4 }]}>
                        <View style={styles.metricHeader}>
                            <Text style={styles.metricLabel}>Total Sales (Gross)</Text>
                            <View style={[styles.metricIconBg, { backgroundColor: '#E8F5E9' }]}>
                                <Ionicons name="trending-up-outline" size={18} color="#10B981" />
                            </View>
                        </View>
                        <Text style={styles.metricValue}>R{totalGrossRevenue.toFixed(2)}</Text>
                        <Text style={styles.metricSub}>Overall vendor sales</Text>
                    </View>

                    <View style={[styles.metricCard, { borderLeftColor: '#FF6B00', borderLeftWidth: 4 }]}>
                        <View style={styles.metricHeader}>
                            <Text style={styles.metricLabel}>Platform Commission</Text>
                            <View style={[styles.metricIconBg, { backgroundColor: '#FFF3E0' }]}>
                                <Ionicons name="wallet-outline" size={18} color="#FF6B00" />
                            </View>
                        </View>
                        <Text style={[styles.metricValue, { color: '#FF6B00' }]}>R{totalCommission.toFixed(2)}</Text>
                        <Text style={styles.metricSub}>Revenue earned by platform</Text>
                    </View>

                    <View style={[styles.metricCard, { borderLeftColor: '#3B82F6', borderLeftWidth: 4 }]}>
                        <View style={styles.metricHeader}>
                            <Text style={styles.metricLabel}>Vendor Net Payout</Text>
                            <View style={[styles.metricIconBg, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="cash-outline" size={18} color="#3B82F6" />
                            </View>
                        </View>
                        <Text style={styles.metricValue}>R{netPayout.toFixed(2)}</Text>
                        <Text style={styles.metricSub}>Amount payable to vendors</Text>
                    </View>

                    <View style={[styles.metricCard, { borderLeftColor: '#8B5CF6', borderLeftWidth: 4 }]}>
                        <View style={styles.metricHeader}>
                            <Text style={styles.metricLabel}>Total Orders</Text>
                            <View style={[styles.metricIconBg, { backgroundColor: '#F5F3FF' }]}>
                                <Ionicons name="receipt-outline" size={18} color="#8B5CF6" />
                            </View>
                        </View>
                        <Text style={styles.metricValue}>{totalOrdersCount}</Text>
                        <Text style={styles.metricSub}>Number of successful sales</Text>
                    </View>
                </View>

                <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Transaction History</Text>
                    <Text style={styles.sectionCount}>({displayedOrders.length} sales)</Text>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={18} color="#999" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by title, customer, or ID..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#999"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#999" />
                        </TouchableOpacity>
                    )}
                </View>

                {loading ? (
                    <View style={styles.centerLoading}>
                        <ActivityIndicator size="large" color="#FF6B00" />
                        <Text style={styles.loadingText}>Loading revenue data...</Text>
                    </View>
                ) : displayedOrders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="wallet-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No transactions found</Text>
                        <Text style={styles.emptySub}>Sales will appear here when customers purchase coupons.</Text>
                    </View>
                ) : (
                    displayedOrders.map((ord: any) => {
                        const firstItem = ord.items && ord.items[0];
                        const gross = Number(ord.total_amount) || 0;
                        const vendorData = vendors.find(v => String(v.id) === String(ord.vendor_id));
                        const tier = vendorData?.tier_status || vendorData?.membership_tier || 'Bronze';
                        const commissionRate = getCommissionRate(tier);
                        const comm = gross * commissionRate;
                        const net = gross - comm;

                        return (
                            <View key={ord.id} style={styles.transactionCard}>
                                <View style={styles.txHeader}>
                                    <View style={styles.txIdGroup}>
                                        <Text style={styles.txId}>ORD-{ord.id}</Text>
                                        <View style={styles.paidBadge}>
                                            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                            <Text style={styles.paidBadgeText}>
                                                {(ord.payment_status || 'PAID').toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.txDate}>
                                        {new Date(ord.created_at).toLocaleDateString()} •{' '}
                                        {new Date(ord.created_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                </View>

                                <Text style={styles.txTitle}>{firstItem ? firstItem.title : 'Coupon Purchase'}</Text>

                                <View style={styles.txCustomerRow}>
                                    <Ionicons name="person-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                    <Text style={styles.txCustomer}>
                                        {ord.customer_name || `Customer #${ord.user_id}`}
                                    </Text>
                                    <Text style={{ marginHorizontal: 6, color: '#CBD5E1' }}>|</Text>
                                    <Ionicons name="business-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                    <Text style={styles.txCustomer} numberOfLines={1}>
                                        {ord.vendor_name || `Vendor #${ord.vendor_id}`}
                                    </Text>
                                </View>

                                <View style={styles.txDivider} />

                                <View style={styles.txFinancials}>
                                    <View style={styles.txFinancialItem}>
                                        <Text style={styles.txFinancialLabel}>Gross</Text>
                                        <Text style={styles.txGrossVal}>R{gross.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.txFinancialItem}>
                                        <Text style={styles.txFinancialLabel}>Platform Fee ({(commissionRate * 100).toFixed(0)}%)</Text>
                                        <Text style={styles.txFeeVal}>R{comm.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.txFinancialItem}>
                                        <Text style={styles.txFinancialLabel}>Vendor Net</Text>
                                        <Text style={styles.txNetVal}>R{net.toFixed(2)}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    pageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    pageTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    pageSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },
    refreshBtn: {
        padding: 8,
        backgroundColor: '#FFF3E0',
        borderRadius: 8,
    },
    vendorPickerBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    dropdownContainer: {
        position: 'absolute',
        top: 48,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxHeight: 220,
        zIndex: 99,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 20,
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    dropdownItemActive: {
        backgroundColor: '#FFF5EB',
    },
    dropdownItemText: {
        fontSize: 13,
        color: '#1F2937',
    },
    dropdownItemTextActive: {
        color: '#FF6B00',
        fontWeight: '600',
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    filterChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    filterChipActive: {
        backgroundColor: '#FF6B00',
        borderColor: '#FF6B00',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    filterChipTextActive: {
        color: '#FFF',
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    metricCard: {
        width: '48%',
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    metricHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    metricLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    metricIconBg: {
        width: 28,
        height: 28,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2,
    },
    metricSub: {
        fontSize: 11,
        color: '#94A3B8',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    sectionCount: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        height: 42,
        marginBottom: 14,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0F172A',
    },
    centerLoading: {
        paddingVertical: 40,
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        color: '#64748B',
        fontSize: 13,
    },
    emptyContainer: {
        paddingVertical: 50,
        alignItems: 'center',
        gap: 8,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569',
    },
    emptySub: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        maxWidth: 240,
    },
    transactionCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    txHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    txIdGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    txId: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    paidBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    paidBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669',
    },
    txDate: {
        fontSize: 11,
        color: '#94A3B8',
    },
    txTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 4,
    },
    txCustomerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    txCustomer: {
        fontSize: 12,
        color: '#64748B',
    },
    txDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 10,
    },
    txFinancials: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 10,
    },
    txFinancialItem: {
        alignItems: 'center',
    },
    txFinancialLabel: {
        fontSize: 11,
        color: '#64748B',
        marginBottom: 2,
    },
    txGrossVal: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    txFeeVal: {
        fontSize: 13,
        fontWeight: '600',
        color: '#10B981',
    },
    txNetVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
});
