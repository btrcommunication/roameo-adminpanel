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
    const [reportsTab, setReportsTab] = useState<'vendor' | 'marketplace'>('vendor');
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
    const [previewImageError, setPreviewImageError] = useState(false);

    // Date picker states
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportData, setReportData] = useState(null);

    const [viewSection, setViewSection] = useState('ads'); // 'ads' | 'analytics'
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsSearch, setAnalyticsSearch] = useState('');
    const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);

    const fetchAnalyticsSummary = async (vendorFilter = selectedVendorFilter, tab = reportsTab) => {
        try {
            setAnalyticsLoading(true);
            const params = new URLSearchParams();
            if (tab) {
                params.append('ad_type', tab);
            }
            if (tab === 'vendor' && vendorFilter && vendorFilter !== 'all') {
                params.append('vendor_id', vendorFilter);
            }
            const url = `${API_BASE_URL}/vendorcreation/ads/reports/summary?${params.toString()}`;
            const response = await fetchWithCors(url);
            const result = await response.json();
            if (result.status === 'success') {
                setAnalyticsData(result.data);
            }
        } catch (e) {
            console.error('Fetch analytics summary error:', e);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const downloadReportPDF = (data, title = 'Ad_Analytics_Report') => {
        if (typeof window !== 'undefined') {
            const summary = data?.summary || {};
            const adsList = data?.ads || [];
            const filterLabel = selectedVendorFilter === 'all' ? 'All Vendors (Platform-Wide)' : (vendors.find(v => String(v.id) === String(selectedVendorFilter))?.business_name || `Vendor #${selectedVendorFilter}`);
            const dateStr = new Date().toLocaleString();

            const rowsHtml = adsList.map((a, i) => `
                <tr style="background-color: ${i % 2 === 1 ? '#f9fafb' : '#ffffff'};">
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">#${a.id}</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">
                        <div style="font-weight: 600; color: #111827;">${a.title || 'Untitled'}</div>
                        <div style="font-size: 11px; color: #6b7280;">${a.category_name || ''}</div>
                    </td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #374151;">
                        ${a.ad_type === 'marketplace' ? 'Marketplace' : (a.vendor_name || `Vendor #${a.vendor_id}`)}
                    </td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background-color: ${a.campaign_type === 'notification' ? '#fee2e2' : '#eff6ff'}; color: ${a.campaign_type === 'notification' ? '#991b1b' : '#1d4ed8'};">
                            ${a.campaign_type === 'notification' ? 'Notification' : 'Featured'}
                        </span>
                    </td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #374151;">
                        ${a.target_type === 'coupon' ? 'Coupons' : a.target_type === 'category' ? 'Category' : 'Store / Global'}
                    </td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${a.total_impressions || 0}</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #2563eb;">${a.total_clicks || 0}</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: #ff5500;">${a.ctr || 0}%</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background-color: ${a.approval_status === 'approved' ? '#d1fae5' : a.approval_status === 'disapproved' ? '#fee2e2' : '#fef3c7'}; color: ${a.approval_status === 'approved' ? '#065f46' : a.approval_status === 'disapproved' ? '#991b1b' : '#92400e'};">
                            ${a.approval_status ? a.approval_status.charAt(0).toUpperCase() + a.approval_status.slice(1) : 'Pending'}
                        </span>
                    </td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;">
                        ${a.start_date && a.end_date ? `${new Date(a.start_date).toLocaleDateString()} - ${new Date(a.end_date).toLocaleDateString()}` : 'N/A'}
                    </td>
                </tr>
            `).join('');

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${title}</title>
                    <meta charset="utf-8" />
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #111827; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ff5500; padding-bottom: 16px; margin-bottom: 24px; }
                        .logo-text { font-size: 24px; font-weight: 900; color: #ff5500; }
                        .sub-header { font-size: 13px; color: #6b7280; margin-top: 4px; }
                        .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
                        .kpi-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; text-align: center; }
                        .kpi-val { font-size: 22px; font-weight: 800; color: #111827; }
                        .kpi-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-top: 4px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                        th { background: #f3f4f6; color: #374151; font-weight: 700; padding: 10px 8px; border-bottom: 2px solid #e5e7eb; text-align: left; }
                        .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
                        @media print {
                            body { margin: 15px; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="logo-text">ROAMEO <span style="font-size: 16px; color: #374151; font-weight: 600;">| Ads Performance & Analytics Report</span></div>
                            <div class="sub-header">Scope: <strong>${filterLabel}</strong> &bull; Generated: ${dateStr}</div>
                        </div>
                    </div>

                    <div class="kpi-row">
                        <div class="kpi-box">
                            <div class="kpi-val">${summary.total_ads || adsList.length}</div>
                            <div class="kpi-lbl">Total Campaigns</div>
                        </div>
                        <div class="kpi-box">
                            <div class="kpi-val" style="color: #3b82f6;">${summary.total_impressions || 0}</div>
                            <div class="kpi-lbl">Total Impressions</div>
                        </div>
                        <div class="kpi-box">
                            <div class="kpi-val" style="color: #10b981;">${summary.total_clicks || 0}</div>
                            <div class="kpi-lbl">Total Clicks</div>
                        </div>
                        <div class="kpi-box">
                            <div class="kpi-val" style="color: #ff5500;">${summary.average_ctr || 0}%</div>
                            <div class="kpi-lbl">Average CTR</div>
                        </div>
                    </div>

                    <h3 style="font-size: 15px; margin-bottom: 8px; color: #374151;">Detailed Campaign Breakdown</h3>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px;">#ID</th>
                                <th>Campaign / Title</th>
                                <th>Vendor</th>
                                <th style="text-align: center;">Type</th>
                                <th>Targeting</th>
                                <th style="text-align: center;">Views</th>
                                <th style="text-align: center;">Clicks</th>
                                <th style="text-align: center;">CTR</th>
                                <th style="text-align: center;">Status</th>
                                <th>Schedule</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="footer">
                        Roameo Advertising Platform &bull; Confidential &bull; Generated dynamically on ${dateStr}
                    </div>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                }, 400);
            }
        } else {
            Alert.alert('Download Report', 'Report generation is ready. Please view or print on web.');
        }
    };

    const openReportModal = async (ad) => {
        try {
            setReportLoading(true);
            setReportData(null);
            setReportModalVisible(true);
            const url = `${API_BASE_URL}/vendorcreation/ads/${ad.id}/report`;
            const response = await fetchWithCors(url);
            const result = await response.json();
            if (result.status === 'success') {
                setReportData(result.data);
            } else {
                Alert.alert('Error', result.message || 'Failed to fetch report');
            }
        } catch (err) {
            console.error('Fetch report error:', err);
            Alert.alert('Error', 'Failed to fetch ad report');
        } finally {
            setReportLoading(false);
        }
    };

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
            const endDate = ad.end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
        fetchAnalyticsSummary();
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
        fetchAnalyticsSummary();
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
        setPreviewImageError(false);
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
        setPreviewImageError(false);
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
                        setPreviewImageError(false);
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
                            {/* Pending Ads: Only Approve and Reject Icon Buttons */}
                            {(!ad.approval_status || ad.approval_status === 'pending') && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => handleApprovePrompt(ad)}
                                        style={[styles.iconActionBtn, { backgroundColor: '#DEF7EC', borderColor: '#BCF0DA' }]}
                                        accessibilityLabel="Approve Ad"
                                        {...({ title: 'Approve Ad' } as any)}
                                    >
                                        <Ionicons name="checkmark-circle" size={17} color={COLORS.greenSuccess} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleRejectPrompt(ad)}
                                        style={[styles.iconActionBtn, { backgroundColor: '#FDE8E8', borderColor: '#FBD5D5' }]}
                                        accessibilityLabel="Reject Ad"
                                        {...({ title: 'Reject Ad' } as any)}
                                    >
                                        <Ionicons name="close-circle" size={17} color={COLORS.redDanger} />
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* Approved Ads: Report, Edit, Delete Icon Buttons */}
                            {ad.approval_status === 'approved' && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => openReportModal(ad)}
                                        style={[styles.iconActionBtn, { backgroundColor: '#FFF5EB', borderColor: '#FFE0CC' }]}
                                        disabled={isDeleting}
                                        accessibilityLabel="View Report"
                                        {...({ title: 'View Report' } as any)}
                                    >
                                        <Ionicons name="bar-chart" size={15} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => openEditModal(ad)}
                                        style={[styles.iconActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}
                                        disabled={isDeleting}
                                        accessibilityLabel="Edit Ad"
                                        {...({ title: 'Edit Ad' } as any)}
                                    >
                                        <Ionicons name="pencil" size={15} color="#2563EB" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleDelete(ad.id, ad.title)}
                                        style={[styles.iconActionBtn, { backgroundColor: '#FDE8E8', borderColor: '#FBD5D5' }]}
                                        disabled={isDeleting}
                                        accessibilityLabel="Delete Ad"
                                        {...({ title: 'Delete Ad' } as any)}
                                    >
                                        <Ionicons name="trash" size={15} color={COLORS.redDanger} />
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* Disapproved / Rejected Ads: Delete Icon Button Only */}
                            {ad.approval_status === 'disapproved' && (
                                <TouchableOpacity
                                    onPress={() => handleDelete(ad.id, ad.title)}
                                    style={[styles.iconActionBtn, { backgroundColor: '#FDE8E8', borderColor: '#FBD5D5' }]}
                                    disabled={isDeleting}
                                    accessibilityLabel="Delete Ad"
                                    {...({ title: 'Delete Ad' } as any)}
                                >
                                    <Ionicons name="trash" size={15} color={COLORS.redDanger} />
                                </TouchableOpacity>
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
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <View style={styles.viewSectionTabs}>
                    <TouchableOpacity
                        style={[styles.viewSectionBtn, viewSection === 'ads' && styles.viewSectionBtnActive]}
                        onPress={() => setViewSection('ads')}
                    >
                        <Ionicons name="megaphone" size={16} color={viewSection === 'ads' ? COLORS.primary : COLORS.textMuted} />
                        <Text style={[styles.viewSectionBtnText, viewSection === 'ads' && styles.viewSectionBtnTextActive]} numberOfLines={1}>
                            Manage Ads
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.viewSectionBtn, viewSection === 'analytics' && styles.viewSectionBtnActive]}
                        onPress={() => {
                            setViewSection('analytics');
                            fetchAnalyticsSummary(selectedVendorFilter, reportsTab);
                        }}
                    >
                        <Ionicons name="stats-chart" size={16} color={viewSection === 'analytics' ? COLORS.primary : COLORS.textMuted} />
                        <Text style={[styles.viewSectionBtnText, viewSection === 'analytics' && styles.viewSectionBtnTextActive]} numberOfLines={1}>
                            Ad Reports & Analytics
                        </Text>
                    </TouchableOpacity>
                </View>

                {viewSection === 'ads' ? (
                    <>
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
                            <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', marginHorizontal: 20, marginTop: 10, borderRadius: 8, padding: 4 }}>
                                <TouchableOpacity
                                    style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: vendorAdType === 'featured' ? '#FFF' : 'transparent', shadowOpacity: vendorAdType === 'featured' ? 0.1 : 0 }}
                                    onPress={() => setVendorAdType('featured')}
                                >
                                    <Text style={{ fontWeight: vendorAdType === 'featured' ? 'bold' : '500', color: vendorAdType === 'featured' ? '#111827' : '#6B7280' }}>Featured</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: vendorAdType === 'notification' ? '#FFF' : 'transparent', shadowOpacity: vendorAdType === 'notification' ? 0.1 : 0 }}
                                    onPress={() => setVendorAdType('notification')}
                                >
                                    <Text style={{ fontWeight: vendorAdType === 'notification' ? 'bold' : '500', color: vendorAdType === 'notification' ? '#111827' : '#6B7280' }}>Notification</Text>
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
                    </>
                ) : (
                    /* AD REPORTS & ANALYTICS VIEW FOR ADMIN */
                    <View style={styles.analyticsMainContainer}>
                        {/* Reports Type Tabs */}
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.tab,
                                    styles.vendorTab,
                                    reportsTab === 'vendor' && styles.activeTab
                                ]}
                                onPress={() => {
                                    setReportsTab('vendor');
                                    fetchAnalyticsSummary(selectedVendorFilter, 'vendor');
                                }}
                            >
                                <Ionicons
                                    name="pricetag-outline"
                                    size={18}
                                    color={reportsTab === 'vendor' ? '#FFF' : COLORS.primary}
                                />
                                <Text style={[
                                    styles.tabText,
                                    reportsTab === 'vendor' && styles.activeTabText
                                ]}>
                                    Vendor Ads
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.tab,
                                    styles.marketplaceTab,
                                    reportsTab === 'marketplace' && styles.activeTab
                                ]}
                                onPress={() => {
                                    setReportsTab('marketplace');
                                    fetchAnalyticsSummary(selectedVendorFilter, 'marketplace');
                                }}
                            >
                                <Ionicons
                                    name="globe-outline"
                                    size={18}
                                    color={reportsTab === 'marketplace' ? '#FFF' : COLORS.marketplaceColor}
                                />
                                <Text style={[
                                    styles.tabText,
                                    reportsTab === 'marketplace' && styles.activeTabText
                                ]}>
                                    Market Place
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Vendor Picker Row - Custom Dropdown (Only for Vendor Reports) */}
                        {reportsTab === 'vendor' && (
                        <View style={{ zIndex: 100, marginBottom: 10 }}>
                            <TouchableOpacity
                                style={[styles.vendorPickerBox, { justifyContent: 'space-between' }]}
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
                                    {/* Transparent overlay to close on outside click */}
                                    <TouchableOpacity
                                        style={{ position: 'absolute', top: 44, left: -1000, right: -1000, bottom: -2000, zIndex: 98 }}
                                        onPress={() => setShowVendorDropdown(false)}
                                        activeOpacity={1}
                                    />
                                    <View style={{
                                        position: 'absolute',
                                        top: 44,
                                        left: 0,
                                        right: 0,
                                        backgroundColor: '#FFFFFF',
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: COLORS.border,
                                        maxHeight: 220,
                                        zIndex: 99,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 8,
                                        elevation: 20,
                                        overflow: 'hidden',
                                    }}>
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
                                                    style={{
                                                        paddingVertical: 11,
                                                        paddingHorizontal: 14,
                                                        borderBottomWidth: 1,
                                                        borderBottomColor: '#F3F4F6',
                                                        backgroundColor: selectedVendorFilter === opt.id ? '#FFF5EB' : '#FFFFFF',
                                                    }}
                                                    onPress={() => {
                                                        setSelectedVendorFilter(opt.id);
                                                        fetchAnalyticsSummary(opt.id);
                                                        setShowVendorDropdown(false);
                                                    }}
                                                >
                                                    <Text style={{
                                                        fontSize: 13,
                                                        color: selectedVendorFilter === opt.id ? COLORS.primary : COLORS.textDark,
                                                        fontWeight: selectedVendorFilter === opt.id ? '600' : '400',
                                                    }}>
                                                        {opt.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </>
                            )}
                        </View>
                        )}

                        {/* Search and PDF Action Row */}
                        <View style={[styles.analyticsControlRow, { flex: 1 }]}>
                            <View style={[styles.searchBar, { flex: 1, minWidth: 0, marginBottom: 0, height: 42, overflow: 'hidden' }]}>
                                <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
                                <TextInput
                                    placeholder="Filter campaigns, category..."
                                    value={analyticsSearch}
                                    onChangeText={setAnalyticsSearch}
                                    style={styles.searchInput}
                                    placeholderTextColor={COLORS.textMuted}
                                />
                                {analyticsSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setAnalyticsSearch('')}>
                                        <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity
                                style={styles.adminPdfBtn}
                                onPress={() => downloadReportPDF(analyticsData, `Ad_Analytics_${selectedVendorFilter === 'all' ? 'All_Vendors' : 'Vendor_' + selectedVendorFilter}`)}
                            >
                                <Ionicons name="download-outline" size={16} color="#FFF" />
                                <Text style={styles.adminPdfBtnText}>Download PDF</Text>
                            </TouchableOpacity>
                        </View>

                        {/* KPI Summary Cards Strip (Identical to Vendor Panel) */}
                        {analyticsData?.summary && (
                            <View style={styles.analyticsKpiGrid}>
                                <View style={styles.analyticsKpiCard}>
                                    <Text style={styles.analyticsKpiValue}>{analyticsData.summary.total_ads || 0}</Text>
                                    <Text style={styles.analyticsKpiLabel}>Total Ads</Text>
                                </View>
                                <View style={styles.analyticsKpiCard}>
                                    <Text style={[styles.analyticsKpiValue, { color: '#3B82F6' }]}>{analyticsData.summary.total_impressions || 0}</Text>
                                    <Text style={styles.analyticsKpiLabel}>Views (Impr)</Text>
                                </View>
                                <View style={styles.analyticsKpiCard}>
                                    <Text style={[styles.analyticsKpiValue, { color: '#10B981' }]}>{analyticsData.summary.total_clicks || 0}</Text>
                                    <Text style={styles.analyticsKpiLabel}>Total Clicks</Text>
                                </View>
                                <View style={styles.analyticsKpiCard}>
                                    <Text style={[styles.analyticsKpiValue, { color: COLORS.primary }]}>{analyticsData.summary.average_ctr || 0}%</Text>
                                    <Text style={styles.analyticsKpiLabel}>Avg CTR</Text>
                                </View>
                            </View>
                        )}

                        {/* Analytics Table */}
                        <View style={styles.analyticsTableWrapper}>
                            <View style={styles.analyticsTableHeaderBar}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="list" size={18} color={COLORS.primary} />
                                    <Text style={styles.analyticsTableHeaderTitle}>
                                        {selectedVendorFilter === 'all' ? 'All Active & Past Campaigns' : `Vendor Campaigns (${analyticsData?.ads?.length || 0})`}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.analyticsReloadBtn}
                                    onPress={() => fetchAnalyticsSummary(selectedVendorFilter)}
                                >
                                    <Ionicons name="refresh" size={14} color={COLORS.textMuted} />
                                    <Text style={styles.analyticsReloadBtnText}>Refresh</Text>
                                </TouchableOpacity>
                            </View>

                            {analyticsLoading ? (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={COLORS.primary} />
                                    <Text style={{ marginTop: 10, color: COLORS.textMuted }}>Loading analytics report...</Text>
                                </View>
                            ) : !analyticsData?.ads || analyticsData.ads.length === 0 ? (
                                <View style={{ padding: 36, alignItems: 'center' }}>
                                    <Ionicons name="bar-chart-outline" size={48} color={COLORS.textMuted} />
                                    <Text style={{ marginTop: 10, fontSize: 14, fontWeight: '600', color: COLORS.textDark }}>No Campaign Data Found</Text>
                                    <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>No ads found matching the selected vendor filter.</Text>
                                </View>
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                    <View style={{ minWidth: 875 }}>
                                        <View style={styles.adminTableHeaderRow}>
                                            <Text style={[styles.adminTableHeaderCell, { width: 50, textAlign: 'left', paddingLeft: 6 }]}>#ID</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 160, textAlign: 'left', paddingHorizontal: 6 }]}>Campaign</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 130, textAlign: 'left', paddingHorizontal: 6 }]}>Vendor</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 85, textAlign: 'center' }]}>Type</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 95, textAlign: 'left', paddingHorizontal: 6 }]}>Targeting</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 70, textAlign: 'center' }]}>Views</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 70, textAlign: 'center' }]}>Clicks</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 70, textAlign: 'center' }]}>CTR</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 70, textAlign: 'center' }]}>Orders</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 85, textAlign: 'center' }]}>Status</Text>
                                            <Text style={[styles.adminTableHeaderCell, { width: 60, textAlign: 'center' }]}>Action</Text>
                                        </View>

                                        {analyticsData.ads
                                            .filter((item) => {
                                                if (!analyticsSearch.trim()) return true;
                                                const q = analyticsSearch.toLowerCase();
                                                return (
                                                    (item.title && item.title.toLowerCase().includes(q)) ||
                                                    (item.vendor_name && item.vendor_name.toLowerCase().includes(q)) ||
                                                    (item.category_name && item.category_name.toLowerCase().includes(q))
                                                );
                                            })
                                            .map((item, idx) => {
                                                const isApproved = item.approval_status === 'approved';
                                                const isDisapproved = item.approval_status === 'disapproved';
                                                return (
                                                    <View key={item.id || idx} style={[styles.adminTableDataRow, idx % 2 === 1 && { backgroundColor: '#F9FAFB' }]}>
                                                        <Text style={[styles.adminTableDataCell, { width: 50, fontWeight: '700', color: COLORS.textMuted, textAlign: 'left', paddingLeft: 6 }]}>#{item.id}</Text>
                                                        <View style={{ width: 160, paddingHorizontal: 6 }}>
                                                            <Text style={styles.adminTableTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                                                            {item.category_name && <Text style={styles.adminTableSub} numberOfLines={1}>{item.category_name}</Text>}
                                                        </View>
                                                        <View style={{ width: 130, paddingHorizontal: 6 }}>
                                                            <Text style={styles.adminTableVendorText} numberOfLines={1}>
                                                                {item.ad_type === 'marketplace' ? '🌐 Marketplace' : (item.vendor_name || `Vendor #${item.vendor_id}`)}
                                                            </Text>
                                                        </View>
                                                        <View style={{ width: 85, alignItems: 'center' }}>
                                                            <Text style={[
                                                                styles.typeBadgeAdmin,
                                                                item.campaign_type === 'notification' ? styles.typeBadgeNotificationAdmin : styles.typeBadgeFeaturedAdmin
                                                            ]}>
                                                                {item.campaign_type === 'notification' ? 'Notif' : 'Featured'}
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.adminTableDataCell, { width: 95, textAlign: 'left', paddingHorizontal: 6 }]} numberOfLines={1}>
                                                            {item.target_type === 'coupon' ? '🎟️ Coupons' : item.target_type === 'category' ? '📁 Category' : 'Store / Global'}
                                                        </Text>
                                                        <Text style={[styles.adminTableDataCell, { width: 70, textAlign: 'center', fontWeight: '600' }]}>{item.total_impressions || 0}</Text>
                                                        <Text style={[styles.adminTableDataCell, { width: 70, textAlign: 'center', fontWeight: '600', color: '#2563EB' }]}>{item.total_clicks || 0}</Text>
                                                        <Text style={[styles.adminTableDataCell, { width: 70, textAlign: 'center', fontWeight: '700', color: COLORS.primary }]}>{item.ctr || 0}%</Text>
                                                        <Text style={[styles.adminTableDataCell, { width: 70, textAlign: 'center', fontWeight: '700', color: '#059669' }]}>{item.total_orders || 0}</Text>
                                                        <View style={{ width: 85, alignItems: 'center' }}>
                                                            <View style={[
                                                                styles.statusBadgePillAdmin,
                                                                isApproved ? styles.statusApprovedAdmin : isDisapproved ? styles.statusDisapprovedAdmin : styles.statusPendingAdmin
                                                            ]}>
                                                                <Text style={[
                                                                    styles.statusBadgeTextAdmin,
                                                                    isApproved ? { color: '#047857' } : isDisapproved ? { color: '#B91C1C' } : { color: '#B45309' }
                                                                ]}>
                                                                    {item.approval_status ? item.approval_status.charAt(0).toUpperCase() + item.approval_status.slice(1) : 'Pending'}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <View style={{ width: 60, alignItems: 'center' }}>
                                                            <TouchableOpacity
                                                                style={styles.adminTableActionBtn}
                                                                onPress={() => openReportModal(item)}
                                                            >
                                                                <Ionicons name="stats-chart" size={14} color={COLORS.primary} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
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
                            {!!formData.image_url && !previewImageError ? (
                                <View style={styles.imagePreviewContainer}>
                                    <Image
                                        source={{ uri: formData.image_url }}
                                        style={styles.imagePreview}
                                        resizeMode="cover"
                                        onError={() => {
                                            setPreviewImageError(true);
                                        }}
                                    />
                                    <TouchableOpacity
                                        style={styles.removeImageButton}
                                        onPress={() => {
                                            setFormData({ ...formData, image_url: '', image_base64: null, image_uri: null, image_file_name: '' });
                                            setPreviewImageError(false);
                                        }}
                                    >
                                        <Ionicons name="close-circle" size={24} color={COLORS.redDanger} />
                                    </TouchableOpacity>
                                </View>
                            ) : !!formData.image_url && previewImageError ? (
                                <View style={[styles.imagePreviewContainer, { height: 70, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 8 }]}>
                                    <Ionicons name="image-outline" size={22} color={COLORS.redDanger} />
                                    <Text style={{ color: COLORS.redDanger, fontSize: 12, marginTop: 4 }}>Image unavailable</Text>
                                    <TouchableOpacity
                                        style={styles.removeImageButton}
                                        onPress={() => {
                                            setFormData({ ...formData, image_url: '', image_base64: null, image_uri: null, image_file_name: '' });
                                            setPreviewImageError(false);
                                        }}
                                    >
                                        <Ionicons name="close-circle" size={24} color={COLORS.redDanger} />
                                    </TouchableOpacity>
                                </View>
                            ) : null}
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
            {/* Ad Performance Report Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={reportModalVisible}
                onRequestClose={() => setReportModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '90%', width: '92%', alignSelf: 'center', maxWidth: 560 }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="stats-chart" size={20} color={COLORS.primary} />
                                <Text style={styles.modalTitle}>Ad Performance Report</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setReportModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color={COLORS.textDark} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 4 }}>
                            {reportLoading ? (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={COLORS.primary} />
                                    <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading live analytics...</Text>
                                </View>
                            ) : reportData ? (
                                <>
                                    {/* Ad Details Summary */}
                                    <View style={styles.reportHeaderCard}>
                                        {reportData.ad?.image_url && !failedImages['report_' + reportData.ad.id] ? (
                                            <Image
                                                source={{ uri: getFullImageUrl(reportData.ad.image_url) }}
                                                style={styles.reportThumb}
                                                resizeMode="cover"
                                                onError={() => {
                                                    setFailedImages(prev => ({ ...prev, ['report_' + reportData.ad.id]: true }));
                                                }}
                                            />
                                        ) : (
                                            <View style={[styles.reportThumb, { justifyContent: 'center', alignItems: 'center' }]}>
                                                <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
                                            </View>
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.reportAdTitle}>{reportData.ad?.title}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                                <View style={[styles.badgeTag, { backgroundColor: reportData.ad?.ad_type === 'marketplace' ? '#E0E7FF' : '#FFEDD5' }]}>
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: reportData.ad?.ad_type === 'marketplace' ? '#3730A3' : '#C2410C' }}>
                                                        {reportData.ad?.ad_type === 'marketplace' ? 'Marketplace Ad' : 'Vendor Ad'}
                                                    </Text>
                                                </View>
                                                <View style={[styles.badgeTag, { backgroundColor: reportData.ad?.campaign_type === 'notification' ? '#FEE2E2' : '#EFF6FF' }]}>
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: reportData.ad?.campaign_type === 'notification' ? '#991B1B' : '#1E40AF' }}>
                                                        {reportData.ad?.campaign_type === 'notification' ? 'Notification' : 'Featured'}
                                                    </Text>
                                                </View>
                                                <View style={[styles.badgeTag, { backgroundColor: reportData.ad?.is_active === 1 ? '#DEF7EC' : '#FDE8E8' }]}>
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: reportData.ad?.is_active === 1 ? '#03543F' : '#9B1C1C' }}>
                                                        {reportData.ad?.is_active === 1 ? 'Active' : 'Inactive'}
                                                    </Text>
                                                </View>
                                            </View>

                                            {reportData.ad?.ad_type === 'marketplace' && !!reportData.ad?.link_url && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                                    <Ionicons name="globe-outline" size={13} color={COLORS.marketplaceColor} />
                                                    <Text style={{ fontSize: 12, color: COLORS.textMuted }} numberOfLines={1}>
                                                        Destination: {reportData.ad.link_url}
                                                    </Text>
                                                </View>
                                            )}

                                            {reportData.ad?.ad_type === 'vendor' && !!reportData.ad?.vendor_name && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                                    <Ionicons name="business-outline" size={13} color={COLORS.textMuted} />
                                                    <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                                                        Vendor: {reportData.ad.vendor_name}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Metric KPI Cards */}
                                    <Text style={styles.sectionHeaderTitle}>Performance Overview</Text>
                                    <View style={styles.kpiGridAdmin}>
                                        <View style={styles.kpiCardAdmin}>
                                            <Ionicons name="eye-outline" size={20} color="#3B82F6" />
                                            <Text style={styles.kpiNumberAdmin}>{reportData.metrics?.total_impressions || 0}</Text>
                                            <Text style={styles.kpiLabelAdmin}>Total Views</Text>
                                        </View>
                                        <View style={styles.kpiCardAdmin}>
                                            <Ionicons name="people-outline" size={20} color="#10B981" />
                                            <Text style={styles.kpiNumberAdmin}>{reportData.metrics?.unique_viewers || 0}</Text>
                                            <Text style={styles.kpiLabelAdmin}>Unique Viewers</Text>
                                        </View>
                                        <View style={styles.kpiCardAdmin}>
                                            <Ionicons name="hand-left-outline" size={20} color="#F59E0B" />
                                            <Text style={styles.kpiNumberAdmin}>{reportData.metrics?.total_clicks || 0}</Text>
                                            <Text style={styles.kpiLabelAdmin}>Total Clicks</Text>
                                        </View>
                                        <View style={styles.kpiCardAdmin}>
                                            <Ionicons name="person-outline" size={20} color="#8B5CF6" />
                                            <Text style={styles.kpiNumberAdmin}>{reportData.metrics?.unique_clickers || 0}</Text>
                                            <Text style={styles.kpiLabelAdmin}>Unique Clickers</Text>
                                        </View>
                                    </View>

                                    {/* CTR Card */}
                                    <View style={styles.ctrBannerAdmin}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.ctrTitleAdmin}>Click-Through Rate (CTR)</Text>
                                            <Text style={styles.ctrDescAdmin}>Percentage of ad views that converted into clicks</Text>
                                        </View>
                                        <Text style={styles.ctrNumberAdmin}>{reportData.metrics?.ctr || 0}%</Text>
                                    </View>

                                    {/* Daily Trends Table */}
                                    <Text style={styles.sectionHeaderTitle}>Activity History (Last 30 Days)</Text>
                                    {reportData.daily_trends && reportData.daily_trends.length > 0 ? (
                                        <View style={styles.reportTable}>
                                            <View style={styles.reportTableHeader}>
                                                <Text style={[styles.reportTableHeaderText, { flex: 1.5 }]}>Date</Text>
                                                <Text style={styles.reportTableHeaderText}>Views</Text>
                                                <Text style={styles.reportTableHeaderText}>Clicks</Text>
                                                <Text style={styles.reportTableHeaderText}>CTR</Text>
                                            </View>
                                            {reportData.daily_trends.map((row, i) => (
                                                <View key={i} style={[styles.reportTableRow, i % 2 === 1 && { backgroundColor: '#F9FAFB' }]}>
                                                    <Text style={[styles.reportTableCell, { flex: 1.5, fontWeight: '500' }]}>{row.date}</Text>
                                                    <Text style={styles.reportTableCell}>{row.impressions}</Text>
                                                    <Text style={styles.reportTableCell}>{row.clicks}</Text>
                                                    <Text style={[styles.reportTableCell, { color: COLORS.primary, fontWeight: 'bold' }]}>{row.ctr}%</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <View style={styles.noHistoryBox}>
                                            <Ionicons name="calendar-outline" size={24} color={COLORS.textMuted} />
                                            <Text style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>No activity logged in the last 30 days yet.</Text>
                                        </View>
                                    )}

                                    <View style={styles.reportFooterAdmin}>
                                        <Text style={styles.reportFooterTextAdmin}>
                                            Report generated dynamically: {new Date(reportData.generated_at).toLocaleString()}
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <Text style={{ textAlign: 'center', marginVertical: 30, color: COLORS.textMuted }}>No report data available.</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Reject Ad Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={rejectModalVisible}
                onRequestClose={() => setRejectModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.deleteModalContent, { width: Platform.OS === 'web' ? '450px' : '90%' }]}>
                        <View style={styles.deleteIconContainer}>
                            <Ionicons name="close-circle-outline" size={48} color={COLORS.redDanger} />
                        </View>
                        <Text style={styles.deleteModalTitle}>Reject Ad</Text>
                        <Text style={[styles.deleteModalMessage, { marginBottom: 12 }]}>
                            Enter a reason for rejecting "{actionAd?.title || 'this ad'}". The vendor will see this explanation.
                        </Text>

                        <TextInput
                            style={[styles.input, { height: 80, width: '100%', textAlignVertical: 'top' }]}
                            placeholder="Reason for rejection (e.g. Image does not meet quality guidelines)..."
                            multiline
                            value={rejectReason}
                            onChangeText={setRejectReason}
                        />

                        <View style={[styles.deleteModalButtons, { marginTop: 16 }]}>
                            <TouchableOpacity
                                style={[styles.btn, styles.btnCancel, styles.deleteModalButton]}
                                onPress={() => {
                                    setRejectModalVisible(false);
                                    setActionAd(null);
                                    setRejectReason('');
                                }}
                            >
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.btn, styles.deleteConfirmButton, { backgroundColor: COLORS.redDanger }]}
                                onPress={submitReject}
                            >
                                <Text style={styles.btnPrimaryText}>Reject Ad</Text>
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
        minWidth: 0,
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
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: 8,
    },
    iconActionBtn: {
        width: 30,
        height: 30,
        borderRadius: 6,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
    reportHeaderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 16,
    },
    reportThumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#E5E7EB',
    },
    reportAdTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    badgeTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    sectionHeaderTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.textDark,
        marginBottom: 10,
        marginTop: 6,
    },
    kpiGridAdmin: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
    },
    kpiCardAdmin: {
        flex: 1,
        minWidth: '46%',
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    kpiNumberAdmin: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textDark,
        marginVertical: 4,
    },
    kpiLabelAdmin: {
        fontSize: 12,
        color: COLORS.textMuted,
    },
    ctrBannerAdmin: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        borderRadius: 8,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FED7AA',
        marginBottom: 16,
    },
    ctrTitleAdmin: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#9A3412',
    },
    ctrDescAdmin: {
        fontSize: 11,
        color: '#C2410C',
        marginTop: 2,
    },
    ctrNumberAdmin: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    reportTable: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
    },
    reportTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    reportTableHeaderText: {
        flex: 1,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#4B5563',
        textAlign: 'center',
    },
    reportTableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        alignItems: 'center',
    },
    reportTableCell: {
        flex: 1,
        fontSize: 12,
        color: COLORS.textDark,
        textAlign: 'center',
    },
    noHistoryBox: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 16,
    },
    reportFooterAdmin: {
        paddingVertical: 12,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        marginBottom: 16,
    },
    reportFooterTextAdmin: {
        fontSize: 11,
        color: COLORS.textMuted,
    },
    viewSectionTabs: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        marginHorizontal: 0,
        marginBottom: 16,
        borderRadius: 10,
        padding: 4,
    },
    viewSectionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        height: 44,
        borderRadius: 8,
        gap: 6,
    },
    viewSectionBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    viewSectionBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    viewSectionBtnTextActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    analyticsMainContainer: {
        paddingBottom: 24,
    },
    vendorPickerBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 42,
        marginBottom: 10,
    },
    vendorFilterPicker: {
        height: 40,
        backgroundColor: 'transparent',
        borderWidth: 0,
        fontSize: 13,
        color: COLORS.textDark,
    },
    analyticsControlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 10,
    },
    adminPdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        paddingHorizontal: 14,
        height: 42,
        borderRadius: 8,
        gap: 6,
        flexShrink: 0,
    },
    adminPdfBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    analyticsKpiGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    analyticsKpiCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    analyticsKpiValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textDark,
    },
    analyticsKpiLabel: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    analyticsTableWrapper: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    analyticsTableHeaderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    analyticsTableHeaderTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textDark,
    },
    analyticsReloadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    analyticsReloadBtnText: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    adminTableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    adminTableHeaderCell: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#4B5563',
        textAlign: 'center',
    },
    adminTableDataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    adminTableDataCell: {
        fontSize: 12,
        color: COLORS.textDark,
        textAlign: 'center',
    },
    adminTableTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textDark,
    },
    adminTableSub: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginTop: 1,
    },
    adminTableVendorText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#374151',
    },
    typeBadgeAdmin: {
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        overflow: 'hidden',
    },
    typeBadgeNotificationAdmin: {
        backgroundColor: '#FEE2E2',
        color: '#991B1B',
    },
    typeBadgeFeaturedAdmin: {
        backgroundColor: '#EFF6FF',
        color: '#1D4ED8',
    },
    statusBadgePillAdmin: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusBadgeTextAdmin: {
        fontSize: 10,
        fontWeight: '700',
    },
    statusApprovedAdmin: {
        backgroundColor: '#D1FAE5',
    },
    statusDisapprovedAdmin: {
        backgroundColor: '#FEE2E2',
    },
    statusPendingAdmin: {
        backgroundColor: '#FEF3C7',
    },
    adminTableActionBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#FFF5EB',
        borderWidth: 1,
        borderColor: '#FED7AA',
        alignItems: 'center',
        justifyContent: 'center',
    },
});