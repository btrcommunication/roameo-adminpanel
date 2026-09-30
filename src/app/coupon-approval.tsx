import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE_URL = `${process.env.EXPO_PUBLIC_BASE_URL}/api`;

// Helper function to handle CORS
const fetchWithCors = async (url, options = {}) => {
    const CORS_PROXY = 'https://corsproxy.io/?';
    
    try {
        const response = await fetch(url, options);
        return response;
    } catch (error) {
        console.log('Direct fetch failed, trying with proxy...');
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, options);
        return response;
    }
};

const COLORS = {
    primary: '#FF5500',
    darkBg: '#111827',
    lightBg: '#F9FAFB',
    cardBg: '#FFFFFF',
    textDark: '#1F2937',
    textMuted: '#6B7280',
    greenSuccess: '#10B981',
    yellowPending: '#F59E0B',
    redDanger: '#EF4444',
    border: '#E5E7EB',
    tagBg: '#FFF0EA',
};

interface Coupon {
    id: string | number;
    code: string;
    title: string;
    subtitle: string;
    description: string;
    banner_image: string;
    coupon_code: string;
    vendor_id: number;
    vendor_name: string;
    valid_from: string;
    expiry: string;
    priority: number;
    campaign_type: string;
    city: string;
    is_active: number;
    is_approved: number;
    disapproval_reason: string | null;
    created_at: string;
    updated_at: string;
}

const PRESET_REASONS = [
    'Discount percentage exceeds allowed limit.',
    'Minimum order value is too low for this discount.',
    'Misleading title or description.',
    'Expiry date is invalid or exceeds maximum duration.',
];

export default function CouponApprovalScreen() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [filteredCoupons, setFilteredCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedTab, setSelectedTab] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        pending: 0,
        inactive: 0,
        expired: 0
    });
    const [error, setError] = useState<string | null>(null);

    // Modal State for Rejection
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
    const [remarks, setRemarks] = useState('');

    // Fetch coupons on component mount
    useEffect(() => {
        fetchCoupons();
        fetchStats();
    }, []);

    // Apply search filter whenever coupons, search, or selectedTab changes
    useEffect(() => {
        applyFilters();
    }, [coupons, search, selectedTab]);

    const fetchCoupons = async (status?: string) => {
        try {
            setLoading(true);
            setError(null);
            let url = `${API_BASE_URL}/coupons`;
            const params = new URLSearchParams();
            
            if (status && status !== 'All') {
                if (status === 'Approved') {
                    params.append('is_approved', '1');
                    params.append('is_active', '1');
                } else if (status === 'Rejected') {
                    params.append('is_approved', '0');
                    params.append('is_active', '0');
                } else if (status === 'Pending') {
                    params.append('is_approved', '0');
                    params.append('is_active', '1');
                }
            }
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            console.log('Fetching coupons from:', url);

            const response = await fetchWithCors(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('Coupons response:', data);
            
            if (data.status === 'success') {
                setCoupons(data.data);
            } else {
                throw new Error(data.message || 'Failed to fetch coupons');
            }
        } catch (error) {
            console.error('Error fetching coupons:', error);
            setError(error instanceof Error ? error.message : 'Failed to load coupons');
            Alert.alert('Error', 'Failed to load coupons. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const url = `${API_BASE_URL}/coupons/stats`;
            console.log('Fetching stats from:', url);
            const response = await fetchWithCors(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('Stats response:', data);
            
            if (data.status === 'success') {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const applyFilters = () => {
        let filtered = [...coupons];

        // Apply tab filter
        if (selectedTab === 'Approved') {
            filtered = filtered.filter(coupon => coupon.is_approved === 1 && coupon.is_active === 1);
        } else if (selectedTab === 'Rejected') {
            filtered = filtered.filter(coupon => coupon.is_approved === 0 && coupon.is_active === 0);
        } else if (selectedTab === 'Pending') {
            filtered = filtered.filter(coupon => coupon.is_approved === 0 && coupon.is_active === 1);
        }

        // Apply search filter (frontend)
        if (search.trim() !== '') {
            const searchLower = search.toLowerCase().trim();
            filtered = filtered.filter(coupon => 
                coupon.coupon_code?.toLowerCase().includes(searchLower) ||
                coupon.title?.toLowerCase().includes(searchLower) ||
                coupon.vendor_name?.toLowerCase().includes(searchLower) ||
                coupon.campaign_type?.toLowerCase().includes(searchLower) ||
                coupon.city?.toLowerCase().includes(searchLower)
            );
        }

        setFilteredCoupons(filtered);
    };

    const handleApprove = async (couponId: string | number) => {
        try {
            setLoading(true);
            const url = `${API_BASE_URL}/coupons/${couponId}/approve`;
            console.log('Approving at:', url);
            
            const response = await fetchWithCors(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                Alert.alert('Success', 'Coupon approved successfully!');
                fetchCoupons(selectedTab === 'All' ? undefined : selectedTab);
                fetchStats();
            } else {
                throw new Error(data.message || 'Failed to approve coupon');
            }
        } catch (error) {
            console.error('Error approving coupon:', error);
            Alert.alert('Error', 'Failed to approve coupon');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!remarks.trim()) {
            Alert.alert('Remarks Required', 'Please explain why this coupon was rejected.');
            return;
        }

        if (!selectedCoupon) return;

        try {
            setLoading(true);
            const url = `${API_BASE_URL}/coupons/${selectedCoupon.id}/disapprove`;
            console.log('Rejecting at:', url);
            
            const response = await fetchWithCors(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: remarks.trim() }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                setRejectModalVisible(false);
                setSelectedCoupon(null);
                setRemarks('');
                Alert.alert('Success', 'Coupon rejected successfully!');
                fetchCoupons(selectedTab === 'All' ? undefined : selectedTab);
                fetchStats();
            } else {
                throw new Error(data.message || 'Failed to reject coupon');
            }
        } catch (error) {
            console.error('Error rejecting coupon:', error);
            Alert.alert('Error', 'Failed to reject coupon');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab: 'All' | 'Pending' | 'Approved' | 'Rejected') => {
        setSelectedTab(tab);
        fetchCoupons(tab === 'All' ? undefined : tab);
    };

    const handleSearch = () => {
        applyFilters();
    };

    const clearSearch = () => {
        setSearch('');
    };

    const openRejectModal = (coupon: Coupon) => {
        setSelectedCoupon(coupon);
        setRemarks(coupon.disapproval_reason || '');
        setRejectModalVisible(true);
    };

    const getStatusBadge = (coupon: Coupon) => {
        if (coupon.is_approved === 1 && coupon.is_active === 1) {
            return { bg: '#DEF7EC', text: '#03543F', label: 'Vendors Approved' };
        } else if (coupon.is_approved === 0 && coupon.is_active === 0) {
            return { bg: '#FDE8E8', text: '#9B1C1C', label: 'Rejected' };
        } else if (coupon.is_approved === 0 && coupon.is_active === 1) {
            return { bg: '#FEF3C7', text: '#92400E', label: 'Pending' };
        } else {
            return { bg: '#F3F4F6', text: '#374151', label: 'Unknown' };
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleStatClick = (tab: 'All' | 'Pending' | 'Approved' | 'Rejected') => {
        setSelectedTab(tab);
        fetchCoupons(tab === 'All' ? undefined : tab);
    };

    const counts = {
        pending: stats.pending || 0,
        approved: stats.active || 0,
        rejected: stats.inactive || 0,
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />

            {/* HEADER */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Roameo Admin</Text>
                <View style={styles.badgeHeader}>
                    <Ionicons name="pricetag" size={14} color={COLORS.primary} />
                    <Text style={styles.badgeHeaderText}>Coupon Control</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* TITLE */}
                <View style={styles.titleRow}>
                    <Text style={styles.breadcrumb}>Promotions &gt; Coupon Approvals</Text>
                    <Text style={styles.pageTitle}>Coupon Approvals</Text>
                    <View style={styles.totalBadge}>
                        <Ionicons name="ticket-outline" size={12} color={COLORS.primary} />
                        <Text style={styles.totalBadgeText}>
                            Total Coupons: {stats.total || coupons.length || 0}
                        </Text>
                    </View>
                </View>

                {/* METRICS METERS - Clickable Cards */}
                <View style={styles.metricsRow}>
                    <TouchableOpacity 
                        style={[
                            styles.statCard, 
                            { borderColor: COLORS.yellowPending },
                            selectedTab === 'Pending' && styles.statCardActive
                        ]}
                        onPress={() => handleStatClick('Pending')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="time-outline" size={16} color={COLORS.yellowPending} />
                        </View>
                        <Text style={styles.statVal}>{counts.pending}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.statCard, 
                            { borderColor: COLORS.greenSuccess },
                            selectedTab === 'Approved' && styles.statCardActive
                        ]}
                        onPress={() => handleStatClick('Approved')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#DEF7EC' }]}>
                            <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.greenSuccess} />
                        </View>
                        <Text style={styles.statVal}>{counts.approved}</Text>
                        <Text style={styles.statLabel}>Vendors Approved</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.statCard, 
                            { borderColor: COLORS.redDanger },
                            selectedTab === 'Rejected' && styles.statCardActive
                        ]}
                        onPress={() => handleStatClick('Rejected')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FDE8E8' }]}>
                            <Ionicons name="close-circle-outline" size={16} color={COLORS.redDanger} />
                        </View>
                        <Text style={styles.statVal}>{counts.rejected}</Text>
                        <Text style={styles.statLabel}>Rejected</Text>
                    </TouchableOpacity>
                </View>

                {/* SEARCH & FILTERS */}
                <View style={styles.filterSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
                        <TextInput
                            placeholder="Search by code, title, vendor, type, or city..."
                            value={search}
                            onChangeText={(text) => {
                                setSearch(text);
                                if (text === '') {
                                    applyFilters();
                                }
                            }}
                            onSubmitEditing={handleSearch}
                            style={styles.searchInput}
                            placeholderTextColor={COLORS.textMuted}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={clearSearch}>
                                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {['Pending', 'All', 'Approved', 'Rejected'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => handleTabChange(tab as any)}
                                style={[
                                    styles.filterChip,
                                    selectedTab === tab && styles.filterChipActive,
                                ]}>
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        selectedTab === tab && styles.filterChipTextActive,
                                    ]}>
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Search Results Count */}
                    {search.length > 0 && (
                        <View style={styles.searchResultInfo}>
                            <Text style={styles.searchResultText}>
                                Found {filteredCoupons.length} result{filteredCoupons.length !== 1 ? 's' : ''} for "{search}"
                            </Text>
                        </View>
                    )}
                </View>

                {/* COUPON CARDS LIST */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Loading coupons...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={48} color={COLORS.redDanger} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={() => fetchCoupons(selectedTab === 'All' ? undefined : selectedTab)}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.couponList}>
                        {filteredCoupons.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Ionicons name="ticket-outline" size={32} color={COLORS.textMuted} />
                                <Text style={styles.emptyText}>
                                    {search.length > 0 
                                        ? `No coupons found matching "${search}"` 
                                        : 'No coupons found in this view.'}
                                </Text>
                            </View>
                        ) : (
                            filteredCoupons.map((item) => {
                                const statusStyle = getStatusBadge(item);
                                const isApproved = item.is_approved === 1 && item.is_active === 1;
                                const isRejected = item.is_approved === 0 && item.is_active === 0;
                                const isPending = item.is_approved === 0 && item.is_active === 1;

                                return (
                                    <View key={item.id} style={styles.couponTicketCard}>
                                        {/* Banner Image */}
                                        <View style={styles.bannerWrapper}>
                                            {item.banner_image ? (
                                                <Image
                                                    source={{ uri: item.banner_image }}
                                                    style={styles.bannerImage}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
                                                    <Ionicons name="image-outline" size={32} color={COLORS.textMuted} />
                                                    <Text style={styles.bannerPlaceholderText}>No banner image</Text>
                                                </View>
                                            )}
                                            {/* Status badge overlaid on banner */}
                                            <View
                                                style={[
                                                    styles.statusBadge,
                                                    styles.statusBadgeOverlay,
                                                    { backgroundColor: statusStyle.bg }
                                                ]}>
                                                <Text
                                                    style={[
                                                        styles.statusBadgeText,
                                                        { color: statusStyle.text }
                                                    ]}>
                                                    {statusStyle.label}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Coupon Top Box */}
                                        <View style={styles.ticketHeader}>
                                            <View style={styles.codeBox}>
                                                <Ionicons name="pricetag-outline" size={14} color={COLORS.primary} />
                                                <Text style={styles.codeText}>{item.coupon_code || 'Pending Approval'}</Text>
                                            </View>
                                            {item.priority != null && (
                                                <View style={styles.priorityBadge}>
                                                    <Text style={styles.priorityBadgeText}>
                                                        Priority {item.priority}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <Text style={styles.couponTitle}>{item.title || 'Untitled Coupon'}</Text>
                                        {item.subtitle ? (
                                            <Text style={styles.couponSubtitle}>{item.subtitle}</Text>
                                        ) : null}
                                        <Text style={styles.vendorSubtitle}>By {item.vendor_name || 'Unknown Vendor'}</Text>

                                        {item.description ? (
                                            <Text style={styles.couponDescription}>
                                                {item.description}
                                            </Text>
                                        ) : null}

                                        {/* Coupon Details Grid */}
                                        <View style={styles.gridContainer}>
                                            <View style={styles.gridItem}>
                                                <Text style={styles.gridLabel}>Type</Text>
                                                <Text style={styles.gridValue}>{item.campaign_type || 'Standard'}</Text>
                                            </View>
                                            <View style={styles.gridItem}>
                                                <Text style={styles.gridLabel}>City</Text>
                                                <Text style={styles.gridValue}>{item.city || 'All Cities'}</Text>
                                            </View>
                                            <View style={styles.gridItem}>
                                                <Text style={styles.gridLabel}>Valid From</Text>
                                                <Text style={styles.gridValue}>{formatDate(item.valid_from)}</Text>
                                            </View>
                                            <View style={styles.gridItem}>
                                                <Text style={styles.gridLabel}>Valid Until</Text>
                                                <Text style={styles.gridValue}>{formatDate(item.expiry)}</Text>
                                            </View>
                                            <View style={styles.gridItem}>
                                                <Text style={styles.gridLabel}>Vendor ID</Text>
                                                <Text style={styles.gridValue}>{item.vendor_id ?? 'N/A'}</Text>
                                            </View>
                                            <View style={styles.gridItem}>
                                                <Text style={styles.gridLabel}>Coupon ID</Text>
                                                <Text style={styles.gridValue}>{item.id ?? 'N/A'}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.expiryRow}>
                                            <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
                                            <Text style={styles.expiryText}>
                                                Created: {formatDate(item.created_at)}
                                            </Text>
                                        </View>

                                        {/* Rejection Remark (If Rejected) */}
                                        {isRejected && item.disapproval_reason && (
                                            <View style={styles.remarkBox}>
                                                <Ionicons name="alert-circle" size={14} color={COLORS.redDanger} />
                                                <Text style={styles.remarkContent}>"{item.disapproval_reason}"</Text>
                                            </View>
                                        )}

                                        {/* Actions */}
                                        <View style={styles.actionRow}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.actionBtn,
                                                    styles.rejectBtn,
                                                    isRejected && styles.activeRejectBtn,
                                                ]}
                                                onPress={() => openRejectModal(item)}
                                                disabled={isApproved}>
                                                <Ionicons
                                                    name="close-circle-outline"
                                                    size={16}
                                                    color={isRejected ? '#FFF' : isApproved ? '#D1D5DB' : COLORS.redDanger}
                                                />
                                                <Text
                                                    style={[
                                                        styles.actionBtnText,
                                                        { color: isRejected ? '#FFF' : isApproved ? '#D1D5DB' : COLORS.redDanger },
                                                    ]}>
                                                    {isRejected ? 'Edit Reason' : isApproved ? 'Reject' : 'Reject'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[
                                                    styles.actionBtn,
                                                    styles.approveBtn,
                                                    isApproved && styles.activeApproveBtn,
                                                ]}
                                                onPress={() => handleApprove(item.id)}
                                                disabled={isApproved}>
                                                <Ionicons
                                                    name="checkmark-circle-outline"
                                                    size={16}
                                                    color={isApproved ? '#FFF' : COLORS.greenSuccess}
                                                />
                                                <Text
                                                    style={[
                                                        styles.actionBtnText,
                                                        { color: isApproved ? '#FFF' : COLORS.greenSuccess },
                                                    ]}>
                                                    {isApproved ? 'Approved ✓' : 'Approve'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Status Message for Approved */}
                                        {isApproved && (
                                            <View style={styles.approvedMessageBox}>
                                                <Ionicons name="checkmark-circle" size={16} color={COLORS.greenSuccess} />
                                                <Text style={styles.approvedMessageText}>
                                                    This coupon has been approved by the admin
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}
            </ScrollView>

            {/* REJECTION REMARKS MODAL */}
            <Modal
                visible={rejectModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setRejectModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Reject Coupon Code</Text>
                                <Text style={styles.modalSub}>
                                    {selectedCoupon?.coupon_code} ({selectedCoupon?.vendor_name})
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                                <Ionicons name="close" size={20} color={COLORS.textDark} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.presetLabel}>Select Common Preset Reason:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetContainer}>
                            {PRESET_REASONS.map((preset, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.presetChip}
                                    onPress={() => setRemarks(preset)}>
                                    <Text style={styles.presetChipText}>{preset}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.inputLabel}>Reason / Remark for Vendor *</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="State clear reason why this coupon is not eligible..."
                            value={remarks}
                            onChangeText={setRemarks}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            placeholderTextColor={COLORS.textMuted}
                        />

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelModalBtn}
                                onPress={() => setRejectModalVisible(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.submitModalBtn}
                                onPress={handleReject}>
                                <Ionicons name="paper-plane-outline" size={14} color="#FFF" />
                                <Text style={styles.submitModalBtnText}>Submit Rejection</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.lightBg,
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
    headerTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    badgeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 4,
    },
    badgeHeaderText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    titleRow: {
        marginBottom: 14,
    },
    breadcrumb: {
        fontSize: 11,
        color: COLORS.textMuted,
    },
    pageTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    totalBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: COLORS.tagBg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
        gap: 6,
    },
    totalBadgeText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '700',
    },
    metricsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.cardBg,
        padding: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    statCardActive: {
        borderWidth: 2,
        borderColor: COLORS.primary,
        backgroundColor: '#FFF5F0',
    },
    iconCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    statVal: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    statLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    filterSection: {
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBg,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 40,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: COLORS.textDark,
    },
    searchResultInfo: {
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginBottom: 6,
    },
    searchResultText: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontStyle: 'italic',
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: COLORS.cardBg,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterChipText: {
        fontSize: 12,
        color: COLORS.textMuted,
    },
    filterChipTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.textMuted,
        fontSize: 14,
    },
    errorContainer: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.redDanger,
    },
    errorText: {
        marginTop: 12,
        color: COLORS.redDanger,
        fontSize: 14,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
    },
    couponList: {
        gap: 14,
    },
    emptyCard: {
        backgroundColor: COLORS.cardBg,
        padding: 30,
        borderRadius: 12,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyText: {
        fontSize: 13,
        color: COLORS.textMuted,
        textAlign: 'center',
    },
    couponTicketCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
    },
    bannerWrapper: {
        width: '100%',
        height: 140,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 12,
        position: 'relative',
        backgroundColor: '#F3F4F6',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    bannerPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    bannerPlaceholderText: {
        fontSize: 11,
        color: COLORS.textMuted,
    },
    statusBadgeOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    codeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.tagBg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    codeText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: COLORS.primary,
        letterSpacing: 0.5,
    },
    priorityBadge: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    priorityBadgeText: {
        color: '#4338CA',
        fontSize: 10,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    couponTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    couponSubtitle: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    vendorSubtitle: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginBottom: 8,
    },
    couponDescription: {
        fontSize: 12,
        color: COLORS.textDark,
        lineHeight: 18,
        marginBottom: 10,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 8,
        gap: 8,
    },
    gridItem: {
        width: '47%',
    },
    gridLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
    },
    gridValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    expiryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    expiryText: {
        fontSize: 11,
        color: COLORS.textMuted,
    },
    remarkBox: {
        backgroundColor: '#FDE8E8',
        borderRadius: 8,
        padding: 8,
        marginTop: 10,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    remarkContent: {
        fontSize: 11,
        color: '#7F1D1D',
        fontStyle: 'italic',
        flex: 1,
    },
    approvedMessageBox: {
        backgroundColor: '#DEF7EC',
        borderRadius: 8,
        padding: 8,
        marginTop: 10,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    approvedMessageText: {
        fontSize: 11,
        color: '#03543F',
        flex: 1,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    actionBtn: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
    },
    rejectBtn: {
        borderColor: COLORS.redDanger,
        backgroundColor: '#FFF',
    },
    activeRejectBtn: {
        backgroundColor: COLORS.redDanger,
        borderColor: COLORS.redDanger,
    },
    approveBtn: {
        borderColor: COLORS.greenSuccess,
        backgroundColor: '#FFF',
    },
    activeApproveBtn: {
        backgroundColor: COLORS.greenSuccess,
        borderColor: COLORS.greenSuccess,
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.cardBg,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    modalSub: {
        fontSize: 12,
        color: COLORS.textMuted,
    },
    presetLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textMuted,
        marginBottom: 6,
    },
    presetContainer: {
        marginBottom: 12,
    },
    presetChip: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 6,
    },
    presetChipText: {
        fontSize: 11,
        color: COLORS.textDark,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textDark,
        marginBottom: 6,
    },
    textArea: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        color: COLORS.textDark,
        height: 90,
        marginBottom: 16,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelModalBtn: {
        flex: 1,
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelModalBtnText: {
        fontSize: 13,
        color: COLORS.textDark,
        fontWeight: '600',
    },
    submitModalBtn: {
        flex: 1,
        height: 40,
        borderRadius: 8,
        backgroundColor: COLORS.redDanger,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    submitModalBtnText: {
        fontSize: 13,
        color: '#FFF',
        fontWeight: '600',
    },
});