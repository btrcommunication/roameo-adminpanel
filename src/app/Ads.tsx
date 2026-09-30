import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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

const API_BASE_URL = `${process.env.EXPO_PUBLIC_BASE_URL}/api`;
const IMAGE_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

// Helper function to handle CORS
const fetchWithCors = async (url, options = {}) => {
    try {
        const response = await fetch(url, options);
        return response;
    } catch (error) {
        console.log('Direct fetch failed, trying with proxy...');
        const CORS_PROXY = 'https://corsproxy.io/?';
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, options);
        return response;
    }
};

// Helper function to get full image URL
const getFullImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    const cleanUrl = url.replace(/^\/+/, '');
    if (cleanUrl.startsWith('uploads')) {
        return `${IMAGE_BASE_URL}/${cleanUrl}`;
    }
    return `${IMAGE_BASE_URL}/uploads/${cleanUrl}`;
};

const COLORS = {
    primary: '#FF5500',
    darkBg: '#111827',
    lightBg: '#F9FAFB',
    cardBg: '#FFFFFF',
    textDark: '#1F2937',
    textMuted: '#6B7280',
    greenSuccess: '#10B981',
    redDanger: '#EF4444',
    border: '#E5E7EB',
    marketplaceColor: '#1A1A1A',
    vendorColor: '#FF5500',
};

export default function AdsManagement() {
    const [ads, setAds] = useState([]);
    const [filteredAds, setFilteredAds] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTab, setSelectedTab] = useState('vendor');
    const [vendorAdType, setVendorAdType] = useState('featured');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleteItemId, setDeleteItemId] = useState(null);
    const [deleteItemTitle, setDeleteItemTitle] = useState('');
    const [failedImages, setFailedImages] = useState({});

    // Date picker states
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        ad_type: 'vendor',
        vendor_id: '',
        link_url: '',
        display_order: '0',
        is_active: 1,
        start_date: '',
        end_date: '',
        campaign_type: 'featured',
        image_base64: null,
        image_url: '',
        image_uri: null,
        image_file_name: '',
    });

    const fetchApprovedVendors = async () => {
        try {
            setLoadingVendors(true);
            const url = `${API_BASE_URL}/vendorcreation`;
            console.log('Fetching vendors from:', url);
            const response = await fetchWithCors(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('Vendors response:', result);
            if (result.status === 'success') {
                const approvedVendors = result.data.filter(
                    (vendor) => vendor.approval_status === 'approved'
                );
                setVendors(approvedVendors);
                console.log('Approved vendors:', approvedVendors);
            } else {
                throw new Error(result.message || 'Failed to fetch vendors');
            }
        } catch (error) {
            console.error('Fetch vendors error:', error);
            Alert.alert('Error', 'Failed to load vendors. Please try again.');
        } finally {
            setLoadingVendors(false);
        }
    };

    
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [actionAd, setActionAd] = useState(null);

    const handleApprovePrompt = (ad) => {
        submitApproveDirect(ad);
    };

    const submitApproveDirect = async (ad) => {
        try {
            setSubmitting(true);
            const startDate = ad.start_date || new Date().toISOString().split('T')[0];
            const endDate = ad.end_date || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
            
            const response = await fetch(`${API_BASE_URL}/vendorcreation/ads/${ad.id}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_date: startDate, end_date: endDate })
            });
            if (response.ok) {
                Alert.alert('Success', 'Ad Approved!');
                fetchAds();
            } else {
                Alert.alert('Error', 'Failed to approve');
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to approve');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRejectPrompt = (ad) => {
        setActionAd(ad);
        setRejectReason('');
        setRejectModalVisible(true);
    };

    const submitReject = async () => {
        if (!rejectReason.trim()) return Alert.alert('Validation', 'Reason required');
        try {
            const response = await fetch(`${API_BASE_URL}/vendorcreation/ads/${actionAd.id}/disapprove`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectReason })
            });
            if (response.ok) {
                Alert.alert('Success', 'Ad Rejected!');
                setRejectModalVisible(false);
                setActionAd(null);
                fetchAds();
            } else {
                Alert.alert('Error', 'Failed to reject');
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to reject');
        }
    };

    const fetchAds = async () => {
        try {
            setError(null);
            const url = `${API_BASE_URL}/vendorcreation/ads`;
            console.log('Fetching ads from:', url);
            const response = await fetchWithCors(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('Ads response:', result);
            if (result.status === 'success') {
                setAds(result.data);
                applyFilters(result.data, selectedTab, searchQuery);
            } else {
                throw new Error(result.message || 'Failed to fetch ads');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            setError(error instanceof Error ? error.message : 'Failed to load ads');
            Alert.alert('Error', 'Failed to load ads. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAds();
        fetchApprovedVendors();
    }, []);

    useEffect(() => {
        applyFilters(ads, selectedTab, searchQuery, vendorAdType);
    }, [ads, selectedTab, searchQuery, vendorAdType]);

    const applyFilters = (adsData, tab, search, vType) => {
        let filtered = adsData.filter(ad => ad.ad_type === tab);
        if (tab === 'vendor') {
            filtered = filtered.filter(ad => ad.campaign_type === vType);
        }
        if (search.trim() !== '') {
            const searchLower = search.toLowerCase().trim();
            filtered = filtered.filter(ad =>
                ad.title?.toLowerCase().includes(searchLower) ||
                ad.description?.toLowerCase().includes(searchLower) ||
                ad.vendor_name?.toLowerCase().includes(searchLower)
            );
        }
        setFilteredAds(filtered);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAds();
        fetchApprovedVendors();
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            ad_type: selectedTab,
            vendor_id: '',
            link_url: '',
            display_order: '0',
            is_active: 1,
            start_date: '',
            end_date: '',
            campaign_type: selectedTab === 'vendor' ? vendorAdType : 'featured',
            image_base64: null,
            image_url: '',
            image_uri: null,
            image_file_name: '',
        });
        setEditingId(null);
        setShowStartDatePicker(false);
        setShowEndDatePicker(false);
    };

    const openAddModal = () => {
        resetForm();
        setFormData(prev => ({ ...prev, ad_type: selectedTab }));
        setModalVisible(true);
    };

    const openEditModal = (ad) => {
        setEditingId(ad.id);
        setFormData({
            title: ad.title || '',
            description: ad.description || '',
            ad_type: ad.ad_type || selectedTab,
            vendor_id: ad.vendor_id?.toString() || '',
            link_url: ad.link_url || '',
            display_order: ad.display_order?.toString() || '0',
            is_active: ad.is_active !== undefined ? ad.is_active : 1,
            start_date: ad.start_date ? ad.start_date.split('T')[0] : '',
            end_date: ad.end_date ? ad.end_date.split('T')[0] : '',
            campaign_type: ad.campaign_type || (selectedTab === 'vendor' ? vendorAdType : 'featured'),
            image_base64: null,
            image_url: getFullImageUrl(ad.image_url) || '',
            image_uri: null,
            image_file_name: '',
        });
        setModalVisible(true);
        setShowStartDatePicker(false);
        setShowEndDatePicker(false);
    };

    const pickImage = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission Denied', 'Please allow photo library permission to upload an image.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
                base64: true,
            });
            if (result.canceled || !result.assets?.length) {
                return;
            }
            const asset = result.assets[0];
            const fileName = asset.fileName || asset.uri.split('/').pop() || `ad_image_${Date.now()}.jpg`;
            let base64Data = asset.base64 || null;
            if (Platform.OS === 'web') {
                try {
                    const response = await fetch(asset.uri);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const resultString = reader.result?.toString() || '';
                        const base64 = resultString.includes(',') ? resultString.split(',')[1] : resultString;
                        setFormData(prev => ({
                            ...prev,
                            image_base64: base64,
                            image_url: asset.uri,
                            image_uri: asset.uri,
                            image_file_name: fileName,
                        }));
                    };
                    reader.onerror = () => {
                        Alert.alert('Error', 'Failed to process selected image.');
                    };
                    reader.readAsDataURL(blob);
                } catch (error) {
                    console.error('Web image processing error:', error);
                    Alert.alert('Error', 'Failed to process the selected image.');
                }
                return;
            }
            if (!base64Data && asset.uri) {
                try {
                    base64Data = await FileSystem.readAsStringAsync(asset.uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                } catch (error) {
                    console.error('Native image read error:', error);
                }
            }
            setFormData(prev => ({
                ...prev,
                image_base64: base64Data,
                image_url: asset.uri,
                image_uri: asset.uri,
                image_file_name: fileName,
            }));
            console.log('Image selected successfully:', {
                uri: asset.uri,
                fileName,
                hasBase64: !!base64Data,
            });
        } catch (error) {
            console.error('Image pick error:', error);
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to pick image.');
        }
    };

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            Alert.alert('Error', 'Please enter an ad title');
            return;
        }
        if (selectedTab === 'vendor' && !formData.vendor_id) {
            Alert.alert('Error', 'Please select a vendor');
            return;
        }
        if (selectedTab === 'marketplace' && !formData.link_url.trim()) {
            Alert.alert('Error', 'Please enter a link URL');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('title', formData.title.trim());
            formDataToSend.append('description', formData.description.trim());
            formDataToSend.append('ad_type', formData.ad_type);
            formDataToSend.append('vendor_id', formData.vendor_id || '');
            formDataToSend.append('link_url', formData.link_url.trim() || '');
            formDataToSend.append('display_order', formData.display_order || '0');
            formDataToSend.append('is_active', formData.is_active.toString());
            formDataToSend.append('start_date', formData.start_date || '');
            formDataToSend.append('end_date', formData.end_date || '');
            formDataToSend.append('campaign_type', formData.campaign_type || 'featured');
            if (formData.image_uri) {
                try {
                    const response = await fetch(formData.image_uri);
                    const blob = await response.blob();
                    const fileName = formData.image_file_name || `ad_image_${Date.now()}.jpg`;
                    const mimeType = blob.type || 'image/jpeg';
                    const imageFile = new File([blob], fileName, { type: mimeType });
                    formDataToSend.append('image', imageFile);
                    console.log('Image added to FormData:', {
                        name: imageFile.name,
                        type: imageFile.type,
                        size: imageFile.size,
                    });
                } catch (imageError) {
                    console.error('Image upload preparation error:', imageError);
                    Alert.alert('Image Error', 'Could not prepare the selected image for upload.');
                    setSubmitting(false);
                    return;
                }
            }
            const url = editingId ?
                `${API_BASE_URL}/vendorcreation/ads/${editingId}` :
                `${API_BASE_URL}/vendorcreation/ads`;
            const method = editingId ? 'PUT' : 'POST';
            console.log('Submitting to:', url);
            console.log('Method:', method);
            console.log('Has image:', !!formData.image_uri);
            for (let pair of formDataToSend.entries()) {
                console.log('FormData entry:', pair[0], pair[1] instanceof File ? 'File' : pair[1]);
            }
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Accept': 'application/json',
                },
                body: formDataToSend,
            });
            if (!response.ok) {
                const text = await response.text();
                console.error('Response error:', text);
                throw new Error(`Server error: ${response.status} - ${text}`);
            }
            const result = await response.json();
            console.log('Submit response:', result);
            if (result.status === 'success') {
                Alert.alert('Success', editingId ? 'Ad updated successfully' : 'Ad added successfully');
                setModalVisible(false);
                resetForm();
                fetchAds();
            } else {
                throw new Error(result.message || 'Failed to save ad');
            }
        } catch (error) {
            console.error('Submit error:', error);
            setError(error instanceof Error ? error.message : 'Failed to save ad');
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save ad. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const performDelete = async () => {
        const id = deleteItemId;
        if (!id) return;
        try {
            setDeletingId(id);
            setError(null);
            setDeleteModalVisible(false);
            console.log('Attempting to delete ad with ID:', id);
            const directUrl = `${API_BASE_URL}/vendorcreation/ads/${id}`;
            console.log('Delete URL (direct):', directUrl);
            let response = await fetch(directUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });
            if (!response.ok) {
                console.log('Direct delete failed, trying with proxy...');
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;
                console.log('Delete URL (proxy):', proxyUrl);
                response = await fetch(proxyUrl, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                });
            }
            console.log('Delete response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Delete error response:', errorText);
                throw new Error(`Failed to delete ad: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            console.log('Delete response:', result);
            if (result.status === 'success') {
                Alert.alert('Success', 'Ad deleted successfully');
                await fetchAds();
            } else {
                throw new Error(result.message || 'Failed to delete ad');
            }
        } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete ad. Please try again.');
        } finally {
            setDeletingId(null);
            setDeleteItemId(null);
            setDeleteItemTitle('');
        }
    };

    const handleDelete = (id, title) => {
        console.log('Delete button pressed for:', id, title);
        setDeleteItemId(id);
        setDeleteItemTitle(title);
        setDeleteModalVisible(true);
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            const newStatus = currentStatus === 1 ? 0 : 1;
            const url = `${API_BASE_URL}/vendorcreation/ads/${id}/toggle`;
            const response = await fetchWithCors(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_active: newStatus }),
            });
            if (!response.ok) {
                throw new Error(`Failed to toggle status: ${response.status}`);
            }
            const result = await response.json();
            if (result.status === 'success') {
                Alert.alert('Success', `Ad ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`);
                fetchAds();
            } else {
                throw new Error(result.message || 'Failed to toggle status');
            }
        } catch (error) {
            console.error('Toggle status error:', error);
            Alert.alert('Error', 'Failed to toggle ad status');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Date picker handlers
    const onStartDateChange = (event, selectedDate) => {
        // Close picker on Android
        if (Platform.OS === 'android') {
            setShowStartDatePicker(false);
        }
        if (selectedDate) {
            const dateString = selectedDate.toISOString().split('T')[0];
            setFormData({ ...formData, start_date: dateString });
        }
        // Close picker on iOS
        if (Platform.OS === 'ios') {
            setShowStartDatePicker(false);
        }
    };

    const onEndDateChange = (event, selectedDate) => {
        // Close picker on Android
        if (Platform.OS === 'android') {
            setShowEndDatePicker(false);
        }
        if (selectedDate) {
            const dateString = selectedDate.toISOString().split('T')[0];
            setFormData({ ...formData, end_date: dateString });
        }
        // Close picker on iOS
        if (Platform.OS === 'ios') {
            setShowEndDatePicker(false);
        }
    };

    // For web, use native input
    const renderDatePickerWeb = (type) => {
        return (
            <input
                type="date"
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: '#F9FAFB',
                    color: '#1F2937',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                }}
                value={type === 'start' ? formData.start_date : formData.end_date}
                onChange={(e) => {
                    if (type === 'start') {
                        setFormData({ ...formData, start_date: e.target.value });
                    } else {
                        setFormData({ ...formData, end_date: e.target.value });
                    }
                }}
            />
        );
    };

    const renderAdCard = (ad) => {
        const isDeleting = deletingId === ad.id;
        const isActive = ad.is_active === 1;
        const imageUrl = getFullImageUrl(ad.image_url);
        console.log('Ad image debug:', {
            id: ad.id,
            title: ad.title,
            original_url: ad.image_url,
            full_url: imageUrl,
        });
        
        return (
            <View key={ad.id} style={styles.adCard}>
                <View style={styles.adCardContent}>
                    {ad.image_url && !failedImages[ad.id] ? (
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.adImage}
                            resizeMode="cover"
                            onError={(e) => {
                                console.log('Image failed to load (using placeholder instead):', imageUrl);
                                setFailedImages(prev => ({ ...prev, [ad.id]: true }));
                            }}
                        />
                    ) : (
                        <View style={[styles.adImage, styles.imagePlaceholder]}>
                            <Ionicons name="image-outline" size={40} color={COLORS.textMuted} />
                        </View>
                    )}
                    <View style={styles.adBody}>
                        <View style={styles.adHeader}>
                            <View style={styles.adTitleContainer}>
                                <Text style={styles.adTitle} numberOfLines={1}>
                                    {ad.title}
                                </Text>
                                <View style={[
                                    styles.statusBadge,
                                    { backgroundColor: isActive ? '#DEF7EC' : '#FDE8E8' }
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        { color: isActive ? '#03543F' : '#9B1C1C' }
                                    ]}>
                                        {isActive ? 'Active' : 'Pending'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => toggleStatus(ad.id, ad.is_active)}
                                style={styles.toggleButton}
                            >
                                <Ionicons
                                    name={isActive ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color={isActive ? COLORS.greenSuccess : COLORS.redDanger}
                                />
                            </TouchableOpacity>
                        </View>
                        {ad.description && (
                            <Text style={styles.adDescription} numberOfLines={2}>
                                {ad.description}
                            </Text>
                        )}
                        <View style={styles.adDetails}>
                            {ad.ad_type === 'marketplace' && !!ad.link_url && (
                                <View style={styles.detailChip}>
                                    <Ionicons name="link-outline" size={14} color={COLORS.marketplaceColor} />
                                    <Text style={styles.detailChipText}>{ad.link_url}</Text>
                                </View>
                            )}
                            {!!ad.vendor_name && (
                                <View style={styles.detailChip}>
                                    <Ionicons name="business-outline" size={14} color={COLORS.textMuted} />
                                    <Text style={styles.detailChipText}>{ad.vendor_name}</Text>
                                </View>
                            )}
                        </View>
                        {(ad.start_date || ad.end_date) && (
                            <View style={styles.dateRow}>
                                <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
                                <Text style={styles.dateText}>
                                    {formatDate(ad.start_date)} - {formatDate(ad.end_date)}
                                </Text>
                            </View>
                        )}
                        {ad.approval_status === 'disapproved' && !!ad.disapproval_reason && (
                            <View style={{ backgroundColor: '#FDE8E8', padding: 8, borderRadius: 6, marginBottom: 12 }}>
                                <Text style={{ color: COLORS.redDanger, fontSize: 12, fontWeight: '500' }}>
                                    Rejected Reason: {ad.disapproval_reason}
                                </Text>
                            </View>
                        )}
                        <View style={styles.actionRow}>
                            {(!ad.approval_status || ad.approval_status === 'pending') && (
                              <>
                                <TouchableOpacity
                                    onPress={() => handleApprovePrompt(ad)}
                                    style={styles.actionBtn}
                                >
                                    <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.greenSuccess} />
                                    <Text style={{color: COLORS.greenSuccess, marginLeft: 4, fontWeight: '500'}}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleRejectPrompt(ad)}
                                    style={styles.actionBtn}
                                >
                                    <Ionicons name="close-circle-outline" size={16} color={COLORS.redDanger} />
                                    <Text style={{color: COLORS.redDanger, marginLeft: 4, fontWeight: '500'}}>Reject</Text>
                                </TouchableOpacity>
                              </>
                            )}
                            {ad.approval_status === 'approved' && (
                              <>
                                <TouchableOpacity
                                    onPress={() => openEditModal(ad)}
                                    style={styles.actionBtn}
                                    disabled={isDeleting}
                                >
                                    <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                                    <Text style={styles.editText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDelete(ad.id, ad.title)}
                                    style={styles.actionBtn}
                                    disabled={isDeleting}
                                >
                                    <Ionicons name="trash-outline" size={16} color={COLORS.redDanger} />
                                    <Text style={styles.deleteText}>Delete</Text>
                                </TouchableOpacity>
                              </>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading ads...</Text>
            
            {/* Reject Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={rejectModalVisible}
                onRequestClose={() => setRejectModalVisible(false)}
            >
                <View style={styles.deleteModalOverlay}>
                    <View style={styles.deleteModalContent}>
                        <View style={styles.deleteModalHeader}>
                            <View style={[styles.deleteIconContainer, { backgroundColor: '#FDE8E8' }]}>
                                <Ionicons name="close-circle-outline" size={24} color={COLORS.redDanger} />
                            </View>
                            <Text style={styles.deleteModalTitle}>Reject Ad</Text>
                            <Text style={styles.deleteModalDesc}>
                                Enter a reason for rejecting this ad.
                            </Text>
                        </View>
                        
                        <TextInput
                            style={[styles.input, {height: 80, marginTop: 15, width: '100%'}]}
                            placeholder="Reason for rejection..."
                            multiline
                            value={rejectReason}
                            onChangeText={setRejectReason}
                        />

                        <View style={styles.deleteModalActions}>
                            <TouchableOpacity 
                                style={styles.cancelDeleteBtn} 
                                onPress={() => {
                                  setRejectModalVisible(false);
                                  setActionAd(null);
                                }}
                            >
                                <Text style={styles.cancelDeleteBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={[styles.confirmDeleteBtn, { backgroundColor: COLORS.redDanger }]} 
                                onPress={submitReject}
                            >
                                <Text style={styles.confirmDeleteBtnText}>Reject Ad</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

</SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Roameo Admin</Text>
                <View style={styles.badgeHeader}>
                    <Ionicons name="megaphone-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.badgeHeaderText}>Ads Management</Text>
                </View>
            </View>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <View style={styles.titleRow}>
                    <Text style={styles.breadcrumb}>Marketing &gt; Ads Management</Text>
                    <Text style={styles.pageTitle}>Ads Management</Text>
                </View>
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            styles.vendorTab,
                            selectedTab === 'vendor' && styles.activeTab
                        ]}
                        onPress={() => setSelectedTab('vendor')}
                    >
                        <Ionicons
                            name="pricetag-outline"
                            size={18}
                            color={selectedTab === 'vendor' ? '#FFF' : COLORS.primary}
                        />
                        <Text style={[
                            styles.tabText,
                            selectedTab === 'vendor' && styles.activeTabText
                        ]}>
                            Vendor Ads
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            styles.marketplaceTab,
                            selectedTab === 'marketplace' && styles.activeTab
                        ]}
                        onPress={() => setSelectedTab('marketplace')}
                    >
                        <Ionicons
                            name="globe-outline"
                            size={18}
                            color={selectedTab === 'marketplace' ? '#FFF' : COLORS.marketplaceColor}
                        />
                        <Text style={[
                            styles.tabText,
                            selectedTab === 'marketplace' && styles.activeTabText
                        ]}>
                            Market Place
                        </Text>
                    </TouchableOpacity>
                </View>
                
                {selectedTab === 'vendor' && (
                    <View style={{flexDirection: 'row', backgroundColor: '#F3F4F6', marginHorizontal: 20, marginTop: 10, borderRadius: 8, padding: 4}}>
                        <TouchableOpacity
                            style={{flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: vendorAdType === 'featured' ? '#FFF' : 'transparent', shadowOpacity: vendorAdType === 'featured' ? 0.1 : 0}}
                            onPress={() => setVendorAdType('featured')}
                        >
                            <Text style={{fontWeight: vendorAdType === 'featured' ? 'bold' : '500', color: vendorAdType === 'featured' ? '#111827' : '#6B7280'}}>Featured</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: vendorAdType === 'notification' ? '#FFF' : 'transparent', shadowOpacity: vendorAdType === 'notification' ? 0.1 : 0}}
                            onPress={() => setVendorAdType('notification')}
                        >
                            <Text style={{fontWeight: vendorAdType === 'notification' ? 'bold' : '500', color: vendorAdType === 'notification' ? '#111827' : '#6B7280'}}>Notification</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.controlsRow}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
                        <TextInput
                            placeholder="Search ads..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={styles.searchInput}
                            placeholderTextColor={COLORS.textMuted}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={openAddModal}
                    >
                        <Ionicons name="add" size={24} color="#FFF" />
                        <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{filteredAds.length}</Text>
                        <Text style={styles.statLabel}>Total {selectedTab === 'vendor' ? 'Vendor' : 'Marketplace'} Ads</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: COLORS.greenSuccess }]}>
                            {filteredAds.filter(ad => ad.is_active === 1).length}
                        </Text>
                        <Text style={styles.statLabel}>Active</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: COLORS.redDanger }]}>
                            {filteredAds.filter(ad => ad.is_active === 0).length}
                        </Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                </View>
                {!!error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={24} color={COLORS.redDanger} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchAds}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {filteredAds.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="megaphone-outline" size={60} color={COLORS.textMuted} />
                        <Text style={styles.emptyStateTitle}>No Ads Found</Text>
                        <Text style={styles.emptyStateText}>
                            Click the "Add" button to create your first ad
                        </Text>
                    </View>
                ) : (
                    filteredAds.map(ad => renderAdCard(ad))
                )}
            </ScrollView>
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => {
                    setModalVisible(false);
                    resetForm();
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingId ? 'Edit Ad' : 'Add New Ad'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setModalVisible(false);
                                    resetForm();
                                }}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color={COLORS.textDark} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>Ad Title *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Summer Sale, Weekend Special"
                                placeholderTextColor={COLORS.textMuted}
                                value={formData.title}
                                onChangeText={(text) => setFormData({ ...formData, title: text })}
                            />
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Describe your ad"
                                placeholderTextColor={COLORS.textMuted}
                                value={formData.description}
                                onChangeText={(text) => setFormData({ ...formData, description: text })}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                            {selectedTab === 'vendor' && (
                                <>
                                    <Text style={styles.label}>Select Vendor *</Text>
                                    <View style={styles.pickerContainer}>
                                        {loadingVendors ? (
                                            <View style={styles.loadingVendorContainer}>
                                                <ActivityIndicator size="small" color={COLORS.primary} />
                                                <Text style={styles.loadingVendorText}>Loading vendors...</Text>
                                            </View>
                                        ) : vendors.length === 0 ? (
                                            <View style={styles.loadingVendorContainer}>
                                                <Ionicons name="alert-circle-outline" size={20} color={COLORS.textMuted} />
                                                <Text style={styles.loadingVendorText}>No approved vendors found</Text>
                                            </View>
                                        ) : (
                                            <Picker
                                                selectedValue={formData.vendor_id}
                                                onValueChange={(itemValue) => {
                                                    setFormData({ ...formData, vendor_id: itemValue });
                                                }}
                                                style={styles.picker}
                                                dropdownIconColor={COLORS.textDark}
                                            >
                                                <Picker.Item
                                                    label="Select a vendor..."
                                                    value=""
                                                    color={COLORS.textMuted}
                                                />
                                                {vendors.map((vendor) => (
                                                    <Picker.Item
                                                        key={vendor.id}
                                                        label={vendor.name || vendor.business_name || `Vendor ${vendor.id}`}
                                                        value={vendor.id.toString()}
                                                        color={COLORS.textDark}
                                                    />
                                                ))}
                                            </Picker>
                                        )}
                                    </View>
                                </>
                            )}
                            {selectedTab === 'marketplace' && (
                                <>
                                    <Text style={styles.label}>Link URL *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="https://example.com/offer"
                                        placeholderTextColor={COLORS.textMuted}
                                        value={formData.link_url}
                                        onChangeText={(text) => setFormData({ ...formData, link_url: text })}
                                        autoCapitalize="none"
                                    />
                                </>
                            )}
                            <Text style={styles.label}>Display Order</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0"
                                placeholderTextColor={COLORS.textMuted}
                                value={formData.display_order}
                                onChangeText={(text) => setFormData({ ...formData, display_order: text })}
                                keyboardType="numeric"
                            />
                            <Text style={styles.label}>Ad Image</Text>
                            <TouchableOpacity
                                style={styles.imagePickerButton}
                                onPress={pickImage}
                            >
                                <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                                <Text style={styles.imagePickerText}>
                                    {formData.image_url ? 'Change Image' : 'Upload Image'}
                                </Text>
                            </TouchableOpacity>
                            {!!formData.image_url && (
                                <View style={styles.imagePreviewContainer}>
                                    <Image
                                        source={{ uri: formData.image_url }}
                                        style={styles.imagePreview}
                                        resizeMode="cover"
                                        onError={(e) => {
                                            console.error('Preview image load error:', e.nativeEvent.error);
                                        }}
                                    />
                                    <TouchableOpacity
                                        style={styles.removeImageButton}
                                        onPress={() => setFormData({ ...formData, image_url: '', image_base64: null, image_uri: null, image_file_name: '' })}
                                    >
                                        <Ionicons name="close-circle" size={24} color={COLORS.redDanger} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <Text style={styles.label}>Start Date</Text>
                            {Platform.OS === 'web' ? (
                                renderDatePickerWeb('start')
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.datePickerButton}
                                        onPress={() => setShowStartDatePicker(true)}
                                    >
                                        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                                        <Text style={styles.datePickerButtonText}>
                                            {formData.start_date ? formatDate(formData.start_date) : 'Select Start Date'}
                                        </Text>
                                    </TouchableOpacity>
                                    {showStartDatePicker && (
                                        <DateTimePicker
                                            value={formData.start_date ? new Date(formData.start_date) : new Date()}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={onStartDateChange}
                                        />
                                    )}
                                </>
                            )}
                            <Text style={styles.label}>End Date</Text>
                            {Platform.OS === 'web' ? (
                                renderDatePickerWeb('end')
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.datePickerButton}
                                        onPress={() => setShowEndDatePicker(true)}
                                    >
                                        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                                        <Text style={styles.datePickerButtonText}>
                                            {formData.end_date ? formatDate(formData.end_date) : 'Select End Date'}
                                        </Text>
                                    </TouchableOpacity>
                                    {showEndDatePicker && (
                                        <DateTimePicker
                                            value={formData.end_date ? new Date(formData.end_date) : new Date()}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={onEndDateChange}
                                        />
                                    )}
                                </>
                            )}
                            <View style={styles.statusToggleRow}>
                                <Text style={styles.label}>Status</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.statusToggle,
                                        formData.is_active === 1 && styles.statusToggleActive
                                    ]}
                                    onPress={() => setFormData({ ...formData, is_active: formData.is_active === 1 ? 0 : 1 })}
                                >
                                    <Text style={[
                                        styles.statusToggleText,
                                        formData.is_active === 1 && styles.statusToggleTextActive
                                    ]}>
                                        {formData.is_active === 1 ? 'Active' : 'Inactive'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.modalButtonRow}>
                                <TouchableOpacity
                                    style={[styles.btn, styles.btnCancel]}
                                    onPress={() => {
                                        setModalVisible(false);
                                        resetForm();
                                    }}
                                >
                                    <Text style={styles.btnCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.btn, styles.btnPrimary]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={styles.btnPrimaryText}>
                                            {editingId ? 'Save Changes' : 'Add Ad'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            <Modal
                animationType="fade"
                transparent={true}
                visible={deleteModalVisible}
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.deleteModalContent]}>
                        <View style={styles.deleteIconContainer}>
                            <Ionicons name="alert-circle" size={60} color={COLORS.redDanger} />
                        </View>
                        <Text style={styles.deleteModalTitle}>Delete Ad</Text>
                        <Text style={styles.deleteModalMessage}>
                            Are you sure you want to delete "{deleteItemTitle}"? This action cannot be undone.
                        </Text>
                        <View style={styles.deleteModalButtons}>
                            <TouchableOpacity
                                style={[styles.btn, styles.btnCancel, styles.deleteModalButton]}
                                onPress={() => {
                                    setDeleteModalVisible(false);
                                    setDeleteItemId(null);
                                    setDeleteItemTitle('');
                                }}
                            >
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btn, styles.deleteConfirmButton]}
                                onPress={performDelete}
                            >
                                <Text style={styles.btnPrimaryText}>Delete</Text>
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
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: COLORS.textMuted,
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
        marginBottom: 16,
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
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
        backgroundColor: 'transparent',
    },
    vendorTab: {
        borderColor: COLORS.primary,
    },
    marketplaceTab: {
        borderColor: COLORS.marketplaceColor,
    },
    activeTab: {
        backgroundColor: COLORS.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    activeTabText: {
        color: '#FFF',
    },
    controlsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBg,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 40,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: COLORS.textDark,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
        marginLeft: 4,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.cardBg,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FDE8E8',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.redDanger,
    },
    errorText: {
        flex: 1,
        color: COLORS.redDanger,
        fontSize: 14,
        marginLeft: 8,
    },
    retryButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    adCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    adCardContent: {
        flexDirection: 'row',
    },
    adImage: {
        width: 140,
        height: 160,
        backgroundColor: '#F3F4F6',
    },
    imagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    adBody: {
        flex: 1,
        padding: 10,
    },
    adHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    adTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    adTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textDark,
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '600',
    },
    toggleButton: {
        padding: 4,
    },
    adDescription: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginBottom: 6,
    },
    adDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 4,
    },
    detailChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 3,
    },
    detailChipText: {
        fontSize: 10,
        color: COLORS.textMuted,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    dateText: {
        fontSize: 10,
        color: COLORS.textMuted,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    editText: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 12,
    },
    deleteText: {
        color: COLORS.redDanger,
        fontWeight: '600',
        fontSize: 12,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textDark,
        marginTop: 12,
    },
    emptyStateText: {
        fontSize: 14,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 20,
        width: '90%',
        maxHeight: '80%',
    },
    deleteModalContent: {
        maxWidth: 340,
        alignItems: 'center',
    },
    deleteIconContainer: {
        marginBottom: 16,
    },
    deleteModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textDark,
        marginBottom: 8,
    },
    deleteModalMessage: {
        fontSize: 14,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    deleteModalButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
    },
    deleteModalButton: {
        flex: 1,
    },
    deleteConfirmButton: {
        backgroundColor: COLORS.redDanger,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    closeButton: {
        padding: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textDark,
        marginBottom: 6,
        marginTop: 10,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.textDark,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    pickerContainer: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 4,
    },
    picker: {
        height: 50,
        color: COLORS.textDark,
    },
    loadingVendorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        gap: 8,
    },
    loadingVendorText: {
        fontSize: 14,
        color: COLORS.textMuted,
    },
    imagePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        borderRadius: 8,
        padding: 16,
        gap: 8,
    },
    imagePickerText: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '500',
    },
    imagePreviewContainer: {
        marginTop: 12,
        position: 'relative',
        alignItems: 'center',
    },
    imagePreview: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    removeImageButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#FFF',
        borderRadius: 12,
    },
    statusToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    statusToggle: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statusToggleActive: {
        backgroundColor: COLORS.greenSuccess,
        borderColor: COLORS.greenSuccess,
    },
    statusToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    statusToggleTextActive: {
        color: '#FFF',
    },
    modalButtonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 20,
        marginBottom: 10,
    },
    btn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    btnPrimary: {
        backgroundColor: COLORS.primary,
    },
    btnPrimaryText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    btnCancel: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    btnCancelText: {
        color: COLORS.textMuted,
        fontWeight: '600',
        fontSize: 14,
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    datePickerButtonText: {
        fontSize: 14,
        color: COLORS.textDark,
        flex: 1,
    },
});