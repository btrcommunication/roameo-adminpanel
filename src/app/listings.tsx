import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
    redInactive: '#EF4444',
    border: '#E5E7EB',
};

interface Category {
    id: number;
    name: string;
    level: number;
}

interface Vendor {
    id: number;
    name: string;
    latitude: string | null;
    longitude: string | null;
}

interface Listing {
    id: number;
    title: string;
    description: string;
    category: Category;
    city: string;
    district: string | null;
    thumbnail: string | null;
    vendor: Vendor;
    rating: number;
    review_count: number;
    original_price: number;
    discount_percentage: number;
    final_price: number;
    offer_label: string | null;
    is_active: boolean;
    is_approved: boolean;
    created_at: string;
    expiry: string | null;
    distance: string | null;
}

export default function ListingsScreen() {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('All');
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        pending: 0,
        inactive: 0
    });
    const [error, setError] = useState<string | null>(null);

    // View Listing Modal
    const [viewModalVisible, setViewModalVisible] = useState(false);
    const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

    useEffect(() => {
        fetchListings();
    }, []);

    const fetchListings = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const url = `${API_BASE_URL}/listings`;
            console.log('Fetching from:', url);
            
            const response = await fetchWithCors(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Listings response:', data);
            
            if (data.status === 'success' && data.data && data.data.listings) {
                // Sort listings by created_at in descending order (latest first)
                const sortedListings = data.data.listings.sort((a: Listing, b: Listing) => {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });
                setListings(sortedListings);
                calculateStats(sortedListings);
            } else {
                throw new Error(data.message || 'Failed to fetch listings');
            }
        } catch (error) {
            console.error('Error fetching listings:', error);
            setError(error instanceof Error ? error.message : 'Failed to load listings');
            Alert.alert('Error', 'Failed to load listings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (listingsData: Listing[]) => {
        const total = listingsData.length;
        const active = listingsData.filter(l => l.is_active).length;
        const inactive = listingsData.filter(l => !l.is_active).length;
        const pending = listingsData.filter(l => !l.is_approved).length;
        
        setStats({ total, active, pending, inactive });
    };

    const getStatusBadge = (listing: Listing) => {
        if (listing.is_active && listing.is_approved) {
            return { bg: '#DEF7EC', text: '#03543F', label: 'Active' };
        } else if (!listing.is_active && listing.is_approved) {
            return { bg: '#FDE8E8', text: '#9B1C1C', label: 'Inactive' };
        } else if (!listing.is_approved) {
            return { bg: '#FEF3C7', text: '#92400E', label: 'Pending' };
        } else {
            return { bg: '#F3F4F6', text: '#374151', label: 'Unknown' };
        }
    };

    const getCategoryColor = (categoryName: string) => {
        const colors: { [key: string]: { bg: string; text: string } } = {
            'Restaurants': { bg: '#FFF0EA', text: '#FF5500' },
            'Pizza': { bg: '#FFF0EA', text: '#FF5500' },
            'Burgers': { bg: '#FFF0EA', text: '#FF5500' },
            'Coffee & Tea': { bg: '#E0F2FE', text: '#0369A1' },
            'Activities': { bg: '#E0F2FE', text: '#0369A1' },
            'Spa & Wellness': { bg: '#F3E8FF', text: '#7E22CE' },
            'Fitness': { bg: '#F3E8FF', text: '#7E22CE' },
            'Adventure': { bg: '#E0F2FE', text: '#0369A1' },
            'Food & Drinks': { bg: '#DCFCE7', text: '#15803D' },
            'Education': { bg: '#FEF3C7', text: '#92400E' },
            'Arts & Crafts': { bg: '#FCE7F3', text: '#9D174D' },
            'Travel': { bg: '#E0F2FE', text: '#0369A1' },
            'Wellness': { bg: '#F3E8FF', text: '#7E22CE' },
            'Entertainment': { bg: '#FEF3C7', text: '#92400E' },
        };
        return colors[categoryName] || { bg: '#F3F4F6', text: '#374151' };
    };

    const getFilteredListings = () => {
        let filtered = listings;

        if (search.trim()) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(item =>
                item.title.toLowerCase().includes(searchLower) ||
                item.vendor.name.toLowerCase().includes(searchLower) ||
                item.city.toLowerCase().includes(searchLower) ||
                item.category.name.toLowerCase().includes(searchLower)
            );
        }

        if (activeTab !== 'All') {
            switch (activeTab) {
                case 'Active':
                    filtered = filtered.filter(item => item.is_active && item.is_approved);
                    break;
                case 'Pending':
                    filtered = filtered.filter(item => !item.is_approved);
                    break;
                case 'Inactive':
                    filtered = filtered.filter(item => !item.is_active && item.is_approved);
                    break;
            }
        }

        return filtered;
    };

    const handleViewListing = (listing: Listing) => {
        setSelectedListing(listing);
        setViewModalVisible(true);
    };

    const getStatusCount = (status: string) => {
        switch (status) {
            case 'All': return listings.length;
            case 'Active': return listings.filter(l => l.is_active && l.is_approved).length;
            case 'Pending': return listings.filter(l => !l.is_approved).length;
            case 'Inactive': return listings.filter(l => !l.is_active && l.is_approved).length;
            default: return 0;
        }
    };

    const handleExport = async () => {
        try {
            const filteredListings = getFilteredListings();
            
            if (filteredListings.length === 0) {
                Alert.alert('No Data', 'No listings available to export.');
                return;
            }

            // Create XLSX content using XML format (Excel compatible)
            let xlsxContent = '';
            
            // Create Excel XML structure
            xlsxContent += '<?xml version="1.0" encoding="UTF-8"?>\n';
            xlsxContent += '<?mso-application progid="Excel.Sheet"?>\n';
            xlsxContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
            xlsxContent += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
            xlsxContent += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
            xlsxContent += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
            
            // Add styles
            xlsxContent += ' <Styles>\n';
            xlsxContent += '  <Style ss:ID="header">\n';
            xlsxContent += '   <Font ss:Bold="1" ss:Size="12"/>\n';
            xlsxContent += '   <Interior ss:Color="#FF5500" ss:Pattern="Solid"/>\n';
            xlsxContent += '   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n';
            xlsxContent += '   <Borders>\n';
            xlsxContent += '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>\n';
            xlsxContent += '   </Borders>\n';
            xlsxContent += '  </Style>\n';
            xlsxContent += '  <Style ss:ID="cell">\n';
            xlsxContent += '   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>\n';
            xlsxContent += '   <Borders>\n';
            xlsxContent += '    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>\n';
            xlsxContent += '   </Borders>\n';
            xlsxContent += '  </Style>\n';
            xlsxContent += ' </Styles>\n';
            
            // Start Worksheet
            xlsxContent += ' <Worksheet ss:Name="Listings">\n';
            xlsxContent += '  <Table>\n';
            
            // Add Headers
            xlsxContent += '   <Row>\n';
            const headers = ['ID', 'Title', 'Category', 'Vendor', 'City', 'Price', 'Status', 'Created At'];
            headers.forEach(header => {
                xlsxContent += `    <Cell ss:StyleID="header"><Data ss:Type="String">${header}</Data></Cell>\n`;
            });
            xlsxContent += '   </Row>\n';
            
            // Add Data Rows
            filteredListings.forEach((item) => {
                const status = item.is_active && item.is_approved ? 'Active' : 
                              !item.is_approved ? 'Pending' : 'Inactive';
                const createdDate = new Date(item.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                
                xlsxContent += '   <Row>\n';
                xlsxContent += `    <Cell ss:StyleID="cell"><Data ss:Type="Number">${item.id}</Data></Cell>\n`;
                xlsxContent += `    <Cell ss:StyleID="cell"><Data ss:Type="String">${item.title}</Data></Cell>\n`;
                xlsxContent += `    <Cell ss:StyleID="cell"><Data ss:Type="String">${item.category.name}</Data></Cell>\n`;
                xlsxContent += `    <Cell ss:StyleID="cell"><Data ss:Type="String">${item.vendor.name}</Data></Cell>\n`;
                xlsxContent += `    <Cell ss:StyleID="cell"><Data ss:Type="String">${item.city}</Data></Cell>\n`;
                xlsxContent += `    <Cell ss:StyleID="cell"><Data ss:Type="Number">${item.final_price}</Data></Cell>\n`;
                xlsxContent += `    <Cell ss:StyleID="cell"><Data ss:Type="String">${status}</Data></Cell>\n`;
                xlsxContent += `    <Cell ss:StyleID="cell"><Data ss:Type="String">${createdDate}</Data></Cell>\n`;
                xlsxContent += '   </Row>\n';
            });
            
            // Close Worksheet and Workbook
            xlsxContent += '  </Table>\n';
            xlsxContent += ' </Worksheet>\n';
            xlsxContent += '</Workbook>';

            // Save file with .xls extension (Excel compatible)
            const fileName = `Listings_${new Date().toISOString().split('T')[0]}.xls`;
            const fileUri = FileSystem.documentDirectory + fileName;
            
            // Write file
            await FileSystem.writeAsStringAsync(fileUri, xlsxContent, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            // Check if sharing is available
            const isSharingAvailable = await Sharing.isAvailableAsync();
            
            if (isSharingAvailable) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/vnd.ms-excel',
                    dialogTitle: 'Export Listings',
                    UTI: 'com.microsoft.excel.xls',
                });
            } else {
                Alert.alert('Share not available', `File saved at: ${fileUri}`);
            }
            
            Alert.alert('Success', `Exported ${filteredListings.length} listings as Excel file!`);
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert('Error', 'Failed to export listings. Please try again.');
        }
    };

    // Handle stat card click
    const handleStatClick = (tab: string) => {
        setActiveTab(tab);
    };

    const filteredListings = getFilteredListings();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />

            {/* --- TOP HEADER --- */}
            <View style={styles.header}>
                <Image
                    source={require('@/assets/images/Roameo-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}>

                {/* BREADCRUMB & TITLE */}
                <View style={styles.titleRow}>
                    <View>
                        <Text style={styles.breadcrumb}>Dashboard &gt; Listings</Text>
                        <Text style={styles.pageTitle}>Listings</Text>
                    </View>
                    {/* <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                        <Ionicons name="download-outline" size={14} color={COLORS.textDark} />
                        <Text style={styles.exportBtnText}>Export</Text>
                    </TouchableOpacity> */}
                </View>

                {/* METRICS STAT CARDS - Clickable */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.metricsContainer}>
                    
                    <TouchableOpacity 
                        style={[styles.statCard, activeTab === 'All' && styles.statCardActive]}
                        onPress={() => handleStatClick('All')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FFF0EA' }]}>
                            <Ionicons name="cube-outline" size={16} color={COLORS.primary} />
                        </View>
                        <Text style={styles.statVal}>{stats.total}</Text>
                        <Text style={styles.statLabel}>Total Listings</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.statCard, activeTab === 'Active' && styles.statCardActive]}
                        onPress={() => handleStatClick('Active')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#DEF7EC' }]}>
                            <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.greenSuccess} />
                        </View>
                        <Text style={styles.statVal}>{stats.active}</Text>
                        <Text style={styles.statLabel}>
                            Active ({stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.statCard, activeTab === 'Pending' && styles.statCardActive]}
                        onPress={() => handleStatClick('Pending')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="time-outline" size={16} color={COLORS.yellowPending} />
                        </View>
                        <Text style={styles.statVal}>{stats.pending}</Text>
                        <Text style={styles.statLabel}>
                            Pending ({stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}%)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.statCard, activeTab === 'Inactive' && styles.statCardActive]}
                        onPress={() => handleStatClick('Inactive')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FDE8E8' }]}>
                            <Ionicons name="close-circle-outline" size={16} color={COLORS.redInactive} />
                        </View>
                        <Text style={styles.statVal}>{stats.inactive}</Text>
                        <Text style={styles.statLabel}>
                            Inactive ({stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0}%)
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* SEARCH AND FILTER BAR */}
                <View style={styles.filterSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
                        <TextInput
                            placeholder="Search listing, vendor, location..."
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

                    {/* Quick Filter Tabs */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
                        {['All', 'Active', 'Pending', 'Inactive'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                style={[
                                    styles.filterChip,
                                    activeTab === tab && styles.filterChipActive,
                                ]}>
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        activeTab === tab && styles.filterChipTextActive,
                                    ]}>
                                    {tab} ({getStatusCount(tab)})
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* LISTINGS DATA CARDS */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Loading listings...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={48} color={COLORS.redInactive} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchListings}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.listingsList}>
                        {filteredListings.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Ionicons name="folder-open-outline" size={32} color={COLORS.textMuted} />
                                <Text style={styles.emptyText}>No listings found</Text>
                            </View>
                        ) : (
                            filteredListings.map((item) => {
                                const badgeStyle = getStatusBadge(item);
                                const categoryStyle = getCategoryColor(item.category.name);

                                return (
                                    <View key={item.id} style={styles.listingCard}>
                                        {/* Header Row: Thumbnail, Title, Price */}
                                        <View style={styles.cardMain}>
                                            <Image 
                                                source={{ 
                                                    uri: item.thumbnail || 'https://via.placeholder.com/50x50/FF5500/FFFFFF?text=L' 
                                                }} 
                                                style={styles.thumbnail} 
                                            />
                                            <View style={styles.cardMainInfo}>
                                                <View style={styles.titlePriceRow}>
                                                    <Text style={styles.listingTitle} numberOfLines={1}>
                                                        {item.title}
                                                    </Text>
                                                    <Text style={styles.listingPrice}>${item.final_price}</Text>
                                                </View>
                                                <View style={styles.locationRow}>
                                                    <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
                                                    <Text style={styles.locationText}>{item.city}</Text>
                                                    {item.discount_percentage > 0 && (
                                                        <View style={styles.discountBadge}>
                                                            <Text style={styles.discountText}>
                                                                -{item.discount_percentage}%
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </View>

                                        {/* Sub Metadata Row */}
                                        <View style={styles.metaRow}>
                                            <View style={[styles.catPill, { backgroundColor: categoryStyle.bg }]}>
                                                <Text style={[styles.catPillText, { color: categoryStyle.text }]}>
                                                    {item.category.name}
                                                </Text>
                                            </View>

                                            <View style={styles.vendorRow}>
                                                <Ionicons name="person-circle-outline" size={14} color={COLORS.textMuted} />
                                                <Text style={styles.vendorName} numberOfLines={1}>
                                                    {item.vendor.name}
                                                </Text>
                                            </View>

                                            <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]}>
                                                <Text style={[styles.statusBadgeText, { color: badgeStyle.text }]}>
                                                    {badgeStyle.label}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Card Footer: Timestamp & Actions */}
                                        <View style={styles.cardFooter}>
                                            <View style={styles.footerLeft}>
                                                <Ionicons name="star" size={12} color="#F59E0B" />
                                                <Text style={styles.ratingText}>
                                                    {item.rating || 0} ({item.review_count || 0})
                                                </Text>
                                                <Text style={styles.dateText}>
                                                    • {new Date(item.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </Text>
                                            </View>

                                            {/* Only View Button */}
                                            <TouchableOpacity 
                                                style={styles.viewButton}
                                                onPress={() => handleViewListing(item)}>
                                                <Ionicons name="eye-outline" size={16} color="#FFF" />
                                                <Text style={styles.viewButtonText}>View</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                {/* Pagination Footer */}
                {filteredListings.length > 0 && !loading && !error && (
                    <View style={styles.paginationCard}>
                        <Text style={styles.paginationInfo}>
                            Showing 1 to {filteredListings.length} of {listings.length} listings
                        </Text>
                        {/* <View style={styles.pageButtons}>
                            <TouchableOpacity style={styles.pageBtnActive}>
                                <Text style={styles.pageBtnTextActive}>1</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.pageBtn}>
                                <Text style={styles.pageBtnText}>2</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.pageBtn}>
                                <Text style={styles.pageBtnText}>3</Text>
                            </TouchableOpacity>
                        </View> */}
                    </View>
                )}
            </ScrollView>

            {/* VIEW LISTING MODAL */}
            <Modal
                visible={viewModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setViewModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Listing Details</Text>
                            <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textDark} />
                            </TouchableOpacity>
                        </View>

                        {selectedListing && (
                            <ScrollView>
                                <View style={styles.modalBody}>
                                    <Image 
                                        source={{ 
                                            uri: selectedListing.thumbnail || 'https://via.placeholder.com/200x200/FF5500/FFFFFF?text=L' 
                                        }} 
                                        style={styles.modalImage} 
                                    />
                                    
                                    <Text style={styles.modalListingTitle}>{selectedListing.title}</Text>
                                    
                                    <View style={styles.modalInfoRow}>
                                        <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} />
                                        <Text style={styles.modalInfoText}>${selectedListing.final_price}</Text>
                                        {selectedListing.discount_percentage > 0 && (
                                            <Text style={styles.modalOriginalPrice}>
                                                ${selectedListing.original_price}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={styles.modalInfoRow}>
                                        <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
                                        <Text style={styles.modalInfoText}>{selectedListing.city}</Text>
                                    </View>

                                    <View style={styles.modalInfoRow}>
                                        <Ionicons name="business-outline" size={16} color={COLORS.textMuted} />
                                        <Text style={styles.modalInfoText}>Vendor: {selectedListing.vendor.name}</Text>
                                    </View>

                                    <View style={styles.modalInfoRow}>
                                        <Ionicons name="folder-outline" size={16} color={COLORS.textMuted} />
                                        <Text style={styles.modalInfoText}>Category: {selectedListing.category.name}</Text>
                                    </View>

                                    {selectedListing.description && (
                                        <View style={styles.modalDescription}>
                                            <Text style={styles.modalDescriptionLabel}>Description:</Text>
                                            <Text style={styles.modalDescriptionText}>
                                                {selectedListing.description}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.modalStatusRow}>
                                        <View style={[styles.modalStatusBadge, 
                                            { backgroundColor: selectedListing.is_active ? '#DEF7EC' : '#FDE8E8' }
                                        ]}>
                                            <Text style={[styles.modalStatusText,
                                                { color: selectedListing.is_active ? '#03543F' : '#9B1C1C' }
                                            ]}>
                                                {selectedListing.is_active ? 'Active' : 'Inactive'}
                                            </Text>
                                        </View>
                                        <View style={[styles.modalStatusBadge, 
                                            { backgroundColor: selectedListing.is_approved ? '#DEF7EC' : '#FEF3C7' }
                                        ]}>
                                            <Text style={[styles.modalStatusText,
                                                { color: selectedListing.is_approved ? '#03543F' : '#92400E' }
                                            ]}>
                                                {selectedListing.is_approved ? 'Approved' : 'Pending'}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={styles.modalDateText}>
                                        Created: {new Date(selectedListing.created_at).toLocaleString('en-US', {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </View>
                            </ScrollView>
                        )}
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
        backgroundColor: COLORS.darkBg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    logo: {
        width: 100,
        height: 32,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 30,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
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
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        gap: 4,
    },
    exportBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textDark,
    },
    metricsContainer: {
        gap: 10,
        marginBottom: 16,
    },
    statCard: {
        backgroundColor: COLORS.cardBg,
        width: 120,
        padding: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    statCardActive: {
        borderColor: COLORS.primary,
    },
    iconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
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
        marginBottom: 14,
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
    tabScroll: {
        flexDirection: 'row',
    },
    filterChip: {
        paddingHorizontal: 12,
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
        borderColor: COLORS.redInactive,
    },
    errorText: {
        marginTop: 12,
        color: COLORS.redInactive,
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
    listingsList: {
        gap: 12,
    },
    listingCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardMain: {
        flexDirection: 'row',
        gap: 10,
    },
    thumbnail: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: COLORS.primary,
    },
    cardMainInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    titlePriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    listingTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.textDark,
        flex: 1,
        marginRight: 6,
    },
    listingPrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    locationText: {
        fontSize: 11,
        color: COLORS.textMuted,
        flex: 1,
    },
    discountBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    discountText: {
        fontSize: 9,
        color: '#FFF',
        fontWeight: 'bold',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    catPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    catPillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    vendorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        marginHorizontal: 6,
    },
    vendorName: {
        fontSize: 11,
        color: COLORS.textDark,
        fontWeight: '500',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    footerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        fontSize: 10,
        color: COLORS.textDark,
    },
    dateText: {
        fontSize: 10,
        color: COLORS.textMuted,
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 4,
    },
    viewButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyCard: {
        backgroundColor: COLORS.cardBg,
        padding: 40,
        borderRadius: 12,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textMuted,
    },
    paginationCard: {
        marginTop: 16,
        alignItems: 'center',
        gap: 8,
    },
    paginationInfo: {
        fontSize: 11,
        color: COLORS.textMuted,
    },
    pageButtons: {
        flexDirection: 'row',
        gap: 6,
    },
    pageBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.cardBg,
    },
    pageBtnActive: {
        width: 28,
        height: 28,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
    },
    pageBtnText: {
        fontSize: 11,
        color: COLORS.textDark,
    },
    pageBtnTextActive: {
        fontSize: 11,
        color: '#FFF',
        fontWeight: 'bold',
    },

    // Modal Styles
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
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    modalBody: {
        gap: 12,
    },
    modalImage: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        backgroundColor: COLORS.primary,
    },
    modalListingTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    modalInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modalInfoText: {
        fontSize: 14,
        color: COLORS.textDark,
        flex: 1,
    },
    modalOriginalPrice: {
        fontSize: 13,
        color: COLORS.textMuted,
        textDecorationLine: 'line-through',
    },
    modalDescription: {
        marginTop: 4,
    },
    modalDescriptionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textDark,
        marginBottom: 4,
    },
    modalDescriptionText: {
        fontSize: 13,
        color: COLORS.textDark,
        lineHeight: 20,
    },
    modalStatusRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    modalStatusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    modalStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    modalDateText: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 4,
    },
});