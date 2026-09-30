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
const fetchWithCors = async (url: string, options: RequestInit = {}) => {
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
};

type ApprovalStatus = 'pending' | 'approved' | 'disapproved';

interface Vendor {
    id: number;
    name: string;
    email: string;
    phone: string;
    address: string;
    business_description: string;
    latitude: string | null;
    longitude: string | null;
    service_radius_meters: number;
    is_active: number;
    created_at: string;
    approval_status: ApprovalStatus;
    disapproval_reason: string | null;
}

const PRESET_REASONS = [
    'Incomplete business documents submitted.',
    'Expired license or ID proof.',
    'Business details could not be verified.',
    'Category or services not supported on platform.',
];

export default function VendorApprovalScreen() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedTab, setSelectedTab] = useState<'all' | 'pending' | 'approved' | 'disapproved'>('all');
    const [error, setError] = useState<string | null>(null);

    // Modal State for Disapproval
    const [disapproveModalVisible, setDisapproveModalVisible] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [remarks, setRemarks] = useState('');

    // Fetch vendors on component mount
    useEffect(() => {
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        try {
            setLoading(true);
            setError(null);
            const url = `${API_BASE_URL}/vendorcreation`;

            console.log('Fetching from:', url);
            const response = await fetchWithCors(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                setVendors(Array.isArray(data.data) ? data.data : []);
            } else {
                throw new Error(data.message || 'Failed to fetch vendors');
            }
        } catch (error) {
            console.error('Error fetching vendors:', error);
            setError(error instanceof Error ? error.message : 'Failed to load vendors');
            Alert.alert('Error', 'Failed to load vendors. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const updateVendorStatus = async (vendor: Vendor, approvalStatus: ApprovalStatus, reason?: string) => {
        const url = `${API_BASE_URL}/vendorcreation/${vendor.id}`;
        const response = await fetchWithCors(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...vendor,
                approval_status: approvalStatus,
                disapproval_reason: reason ?? null,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.status && data.status !== 'success') {
            throw new Error(data.message || 'Failed to update vendor');
        }

        setVendors(current => current.map(item => item.id === vendor.id
            ? { ...item, approval_status: approvalStatus, disapproval_reason: reason ?? null }
            : item));
    };

    const handleApprove = async (vendor: Vendor) => {
        try {
            setLoading(true);
            await updateVendorStatus(vendor, 'approved');
            Alert.alert('Success', 'Vendor approved successfully!');
        } catch (error) {
            console.error('Error approving vendor:', error);
            Alert.alert('Error', 'Failed to approve vendor');
        } finally {
            setLoading(false);
        }
    };

    const handleDisapprove = async () => {
        if (!remarks.trim()) {
            Alert.alert('Remarks Required', 'Please enter a reason for disapproval.');
            return;
        }

        if (!selectedVendor) return;

        try {
            setLoading(true);
            await updateVendorStatus(selectedVendor, 'disapproved', remarks.trim());
            setDisapproveModalVisible(false);
            setSelectedVendor(null);
            setRemarks('');
            Alert.alert('Success', 'Vendor disapproved successfully!');
        } catch (error) {
            console.error('Error disapproving vendor:', error);
            Alert.alert('Error', 'Failed to disapprove vendor');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab: 'all' | 'pending' | 'approved' | 'disapproved') => {
        setSelectedTab(tab);
    };

    const handleSearch = () => {
        // Filtering is performed locally because vendorcreation returns all vendors.
    };

    const openDisapproveModal = (vendor: Vendor) => {
        setSelectedVendor(vendor);
        setRemarks('');
        setDisapproveModalVisible(true);
    };

    const getStatusBadgeStyle = (status: ApprovalStatus) => {
        if (status === 'approved') {
            return { backgroundColor: '#DEF7EC', textColor: '#03543F', label: 'Approved' };
        } else if (status === 'disapproved') {
            return { backgroundColor: '#FDE8E8', textColor: '#9B1C1C', label: 'Disapproved' };
        }
        return { backgroundColor: '#FEF3C7', textColor: '#92400E', label: 'Pending' };
    };

    // Handle stat card click
    const handleStatClick = (tab: 'all' | 'approved' | 'disapproved') => {
        setSelectedTab(tab);
    };

    // Filter vendors based on the selected status and search text.
    const normalizedSearch = search.trim().toLowerCase();
    const filteredVendors = vendors
        .filter(vendor =>
            (selectedTab === 'all' || vendor.approval_status === selectedTab) &&
            (!normalizedSearch || [vendor.name, vendor.email, vendor.phone, vendor.address]
                .some(value => value?.toLowerCase().includes(normalizedSearch)))
        )
        .sort((a, b) => {
            if (selectedTab === 'all') {
                if (a.approval_status === 'pending' && b.approval_status !== 'pending') return -1;
                if (a.approval_status !== 'pending' && b.approval_status === 'pending') return 1;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    const stats = {
        total: vendors.length,
        approved: vendors.filter(vendor => vendor.approval_status === 'approved').length,
        pending: vendors.filter(vendor => vendor.approval_status === 'pending').length,
        disapproved: vendors.filter(vendor => vendor.approval_status === 'disapproved').length,
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />

            {/* HEADER */}
            <View style={styles.header}>
                <Image
                    source={require('@/assets/images/Roameo-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <View style={styles.badgeHeader}>
                    <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
                    <Text style={styles.badgeHeaderText}>Vendor Approvals</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* TITLE */}
                <View style={styles.titleRow}>
                    <View>
                        <Text style={styles.breadcrumb}>Vendors &gt; Approvals</Text>
                        <Text style={styles.pageTitle}>Vendor Approvals</Text>
                    </View>
                </View>

                {/* METRICS - Clickable Cards */}
                <View style={styles.metricsRow}>
                    <TouchableOpacity 
                        style={[
                            styles.statCard, 
                            { borderColor: COLORS.greenSuccess },
                            selectedTab === 'approved' && styles.statCardActive
                        ]}
                        onPress={() => handleStatClick('approved')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#DEF7EC' }]}>
                            <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.greenSuccess} />
                        </View>
                        <Text style={styles.statVal}>{stats.approved}</Text>
                        <Text style={styles.statLabel}>Approved Vendors</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.statCard, 
                            { borderColor: COLORS.redDanger },
                            selectedTab === 'disapproved' && styles.statCardActive
                        ]}
                        onPress={() => handleStatClick('disapproved')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FDE8E8' }]}>
                            <Ionicons name="close-circle-outline" size={16} color={COLORS.redDanger} />
                        </View>
                        <Text style={styles.statVal}>{stats.disapproved}</Text>
                        <Text style={styles.statLabel}>Disapproved</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.statCard, 
                            { borderColor: COLORS.primary },
                            selectedTab === 'all' && styles.statCardActive
                        ]}
                        onPress={() => handleStatClick('all')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FFF0EA' }]}>
                            <Ionicons name="list-outline" size={16} color={COLORS.primary} />
                        </View>
                        <Text style={styles.statVal}>{stats.total}</Text>
                        <Text style={styles.statLabel}>Total Vendors</Text>
                    </TouchableOpacity>
                </View>

                {/* SEARCH & FILTER */}
                <View style={styles.filterSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
                        <TextInput
                            placeholder="Search by name, email, phone, address..."
                            value={search}
                            onChangeText={setSearch}
                            onSubmitEditing={handleSearch}
                            style={styles.searchInput}
                            placeholderTextColor={COLORS.textMuted}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => {
                                setSearch('');
                            }}>
                                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Status Filter Chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {['all', 'approved', 'pending', 'disapproved'].map((tab) => (
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
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* LISTINGS LIST */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Loading vendors...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={48} color={COLORS.redDanger} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchVendors}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.vendorList}>
                        {filteredVendors.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Ionicons name="folder-open-outline" size={32} color={COLORS.textMuted} />
                                <Text style={styles.emptyText}>No vendors found.</Text>
                            </View>
                        ) : (
                            filteredVendors.map((vendor) => {
                                const isApproved = vendor.approval_status === 'approved';
                                const isDisapproved = vendor.approval_status === 'disapproved';
                                const statusStyle = getStatusBadgeStyle(vendor.approval_status);

                                return (
                                    <View key={vendor.id} style={styles.vendorCard}>
                                        {/* Card Header */}
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.avatar, styles.avatarFallback]}>
                                                <Text style={styles.avatarText}>{vendor.name?.charAt(0).toUpperCase() || 'V'}</Text>
                                            </View>
                                            <View style={styles.vendorMainInfo}>
                                                <View style={styles.vendorNameRow}>
                                                    <Text style={styles.businessName}>{vendor.name}</Text>
                                                    <View
                                                        style={[
                                                            styles.statusBadge,
                                                            { backgroundColor: statusStyle.backgroundColor }
                                                        ]}>
                                                        <Text
                                                            style={[
                                                                styles.statusBadgeText,
                                                                { color: statusStyle.textColor }
                                                            ]}>
                                                            {statusStyle.label}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <Text style={styles.ownerText}>{vendor.email}</Text>
                                                <Text style={styles.categoryText}>{vendor.phone || 'Phone not provided'}</Text>
                                            </View>
                                        </View>

                                        {/* Details */}
                                        <View style={styles.detailsBox}>
                                            <View style={styles.detailRow}>
                                                <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                                                <Text style={styles.detailText}>
                                                    {vendor.address || 'Address not specified'}
                                                </Text>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <Ionicons name="navigate-outline" size={14} color={COLORS.textMuted} />
                                                <Text style={styles.detailText}>
                                                    Service radius: {(vendor.service_radius_meters / 1000).toFixed(1)} km
                                                </Text>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
                                                <Text style={styles.detailText}>
                                                    Created: {new Date(vendor.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Description */}
                                        {vendor.business_description && (
                                            <View style={styles.docSection}>
                                                <Text style={styles.sectionLabel}>Description:</Text>
                                                <Text style={styles.descriptionText}>{vendor.business_description}</Text>
                                            </View>
                                        )}

                                        {/* Disapproval Reason */}
                                        {isDisapproved && vendor.disapproval_reason && (
                                            <View style={[styles.docSection, { backgroundColor: '#FDF2F2', borderColor: '#FDE8E8', borderWidth: 1, borderRadius: 6, padding: 10 }]}>
                                                <Text style={[styles.sectionLabel, { color: '#9B1C1C', marginBottom: 2 }]}>Reason for Disapproval:</Text>
                                                <Text style={[styles.descriptionText, { color: '#9B1C1C' }]}>{vendor.disapproval_reason}</Text>
                                            </View>
                                        )}

                                        {/* Action Buttons - Shown only for Pending vendors */}
                                        {vendor.approval_status === 'pending' && (
                                            <View style={styles.actionRow}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.actionBtn,
                                                        styles.disapproveBtn,
                                                    ]}
                                                    onPress={() => openDisapproveModal(vendor)}>
                                                    <Ionicons
                                                        name="close-circle-outline"
                                                        size={16}
                                                        color="#FFF"
                                                    />
                                                    <Text style={[styles.actionBtnText, { color: '#FFF' }]}>
                                                        Disapprove
                                                    </Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[
                                                        styles.actionBtn,
                                                        styles.approveBtn,
                                                    ]}
                                                    onPress={() => handleApprove(vendor)}>
                                                    <Ionicons
                                                        name="checkmark-circle-outline"
                                                        size={16}
                                                        color="#FFF"
                                                    />
                                                    <Text style={[styles.actionBtnText, { color: '#FFF' }]}>
                                                        Approve
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}
            </ScrollView>

            {/* DISAPPROVAL MODAL */}
            <Modal
                visible={disapproveModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setDisapproveModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Disapprove Vendor</Text>
                                <Text style={styles.modalSub}>
                                    {selectedVendor?.name}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setDisapproveModalVisible(false)}>
                                <Ionicons name="close" size={20} color={COLORS.textDark} />
                            </TouchableOpacity>
                        </View>

                        {/* Quick Presets */}
                        <Text style={styles.presetLabel}>Select Common Reason:</Text>
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

                        {/* Custom Remarks */}
                        <Text style={styles.inputLabel}>Message / Remarks *</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Explain why this vendor is being disapproved..."
                            value={remarks}
                            onChangeText={setRemarks}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            placeholderTextColor={COLORS.textMuted}
                        />

                        {/* Modal Footer */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelModalBtn}
                                onPress={() => setDisapproveModalVisible(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.submitModalBtn}
                                onPress={handleDisapprove}>
                                <Ionicons name="paper-plane-outline" size={14} color="#FFF" />
                                <Text style={styles.submitModalBtnText}>Disapprove</Text>
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
    logo: {
        width: 100,
        height: 32,
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
    vendorList: {
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
    },
    vendorCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardHeader: {
        flexDirection: 'row',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    vendorMainInfo: {
        flex: 1,
    },
    vendorNameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    businessName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.textDark,
        flex: 1,
        marginRight: 6,
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
    ownerText: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.textDark,
        marginTop: 2,
    },
    categoryText: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    detailsBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 10,
        marginTop: 10,
        gap: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 11,
        color: COLORS.textDark,
    },
    docSection: {
        marginTop: 10,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textMuted,
        marginBottom: 4,
    },
    descriptionText: {
        fontSize: 12,
        color: COLORS.textDark,
        lineHeight: 18,
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
    disapproveBtn: {
        borderColor: COLORS.redDanger,
        backgroundColor: COLORS.redDanger,
    },
    activeDisapproveBtn: {
        backgroundColor: '#FDE8E8',
        borderColor: '#F8B4B4',
    },
    approveBtn: {
        borderColor: COLORS.greenSuccess,
        backgroundColor: COLORS.greenSuccess,
    },
    activeApproveBtn: {
        backgroundColor: '#DEF7EC',
        borderColor: '#84E1BC',
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },

    /* MODAL STYLES */
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
