const fs = require('fs');
let c = fs.readFileSync('src/app/Ads.tsx', 'utf8');

// 1. Change selectedTab default
c = c.replace(/const \[selectedTab, setSelectedTab\] = useState\('vendor'\);/, "const [selectedTab, setSelectedTab] = useState('featured');");

// 2. Change applyFilters
const oldApply = `    const applyFilters = (adsData, tab, search) => {
        let filtered = adsData.filter(ad => ad.ad_type === tab);
        if (search.trim() !== '') {
            const searchLower = search.toLowerCase().trim();
            filtered = filtered.filter(ad =>
                ad.title?.toLowerCase().includes(searchLower) ||
                ad.description?.toLowerCase().includes(searchLower) ||
                ad.vendor_name?.toLowerCase().includes(searchLower)
            );
        }
        setFilteredAds(filtered);
    };`;

const newApply = `    const applyFilters = (adsData, tab, search) => {
        let filtered = adsData.filter(ad => ad.campaign_type === tab);
        if (search.trim() !== '') {
            const searchLower = search.toLowerCase().trim();
            filtered = filtered.filter(ad =>
                ad.title?.toLowerCase().includes(searchLower) ||
                ad.description?.toLowerCase().includes(searchLower) ||
                ad.vendor_name?.toLowerCase().includes(searchLower)
            );
        }
        setFilteredAds(filtered);
    };`;
c = c.replace(oldApply, newApply);

// 3. Tab Buttons UI
const oldTabsUI = `                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tab, selectedTab === 'vendor' && styles.activeTab]}
                            onPress={() => setSelectedTab('vendor')}
                        >
                            <Ionicons name="pricetag-outline" size={20} color={selectedTab === 'vendor' ? '#FFF' : COLORS.textMuted} />
                            <Text style={[styles.tabText, selectedTab === 'vendor' && styles.activeTabText]}>
                                Vendor Ads
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, selectedTab === 'marketplace' && styles.activeTab]}
                            onPress={() => setSelectedTab('marketplace')}
                        >
                            <Ionicons name="globe-outline" size={20} color={selectedTab === 'marketplace' ? '#FFF' : COLORS.textMuted} />
                            <Text style={[styles.tabText, selectedTab === 'marketplace' && styles.activeTabText]}>
                                Market Place
                            </Text>
                        </TouchableOpacity>
                    </View>`;

const newTabsUI = `                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tab, selectedTab === 'featured' && styles.activeTab]}
                            onPress={() => setSelectedTab('featured')}
                        >
                            <Ionicons name="star-outline" size={20} color={selectedTab === 'featured' ? '#FFF' : COLORS.textMuted} />
                            <Text style={[styles.tabText, selectedTab === 'featured' && styles.activeTabText]}>
                                Featured Ads
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, selectedTab === 'notification' && styles.activeTab]}
                            onPress={() => setSelectedTab('notification')}
                        >
                            <Ionicons name="notifications-outline" size={20} color={selectedTab === 'notification' ? '#FFF' : COLORS.textMuted} />
                            <Text style={[styles.tabText, selectedTab === 'notification' && styles.activeTabText]}>
                                Notifications
                            </Text>
                        </TouchableOpacity>
                    </View>`;
c = c.replace(oldTabsUI, newTabsUI);

// 4. Update Stats Cards (Total Vendor Ads -> Total Featured, Active -> Total Notifications, etc.)
// Just simplifying this part
c = c.replace(/Total Vendor\\nAds/g, 'Total\\nFeatured');
c = c.replace(/Active/g, 'Active');
c = c.replace(/Inactive/g, 'Pending');

// 5. In renderAdCard, add Approve/Reject buttons if pending
const oldStatusBadge = `<View style={[
                                    styles.statusBadge,
                                    { backgroundColor: isActive ? '#DEF7EC' : '#FDE8E8' }
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        { color: isActive ? '#03543F' : '#9B1C1C' }
                                    ]}>
                                        {isActive ? 'Active' : 'Inactive'}
                                    </Text>
                                </View>`;

const newStatusBadge = `<View style={[
                                    styles.statusBadge,
                                    { backgroundColor: ad.approval_status === 'approved' ? '#DEF7EC' : ad.approval_status === 'disapproved' ? '#FDE8E8' : '#FEF3C7' }
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        { color: ad.approval_status === 'approved' ? '#03543F' : ad.approval_status === 'disapproved' ? '#9B1C1C' : '#92400E' }
                                    ]}>
                                        {ad.approval_status ? ad.approval_status.toUpperCase() : 'PENDING'}
                                    </Text>
                                </View>`;
c = c.replace(oldStatusBadge, newStatusBadge);

const oldActionRow = `<View style={styles.actionRow}>
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
                        </View>`;

const newActionRow = `<View style={styles.actionRow}>
                            {ad.approval_status !== 'approved' && (
                              <TouchableOpacity
                                  onPress={() => handleApprovePrompt(ad)}
                                  style={styles.actionBtn}
                              >
                                  <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.greenSuccess} />
                                  <Text style={{color: COLORS.greenSuccess, marginLeft: 4, fontWeight: '500'}}>Approve</Text>
                              </TouchableOpacity>
                            )}
                            {ad.approval_status !== 'disapproved' && (
                              <TouchableOpacity
                                  onPress={() => handleRejectPrompt(ad)}
                                  style={styles.actionBtn}
                              >
                                  <Ionicons name="close-circle-outline" size={16} color={COLORS.redDanger} />
                                  <Text style={{color: COLORS.redDanger, marginLeft: 4, fontWeight: '500'}}>Reject</Text>
                              </TouchableOpacity>
                            )}
                        </View>`;
c = c.replace(oldActionRow, newActionRow);

// 6. Add handleApprovePrompt and handleRejectPrompt
const approveLogic = `
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [actionAd, setActionAd] = useState(null);

    const handleApprovePrompt = (ad) => {
        setActionAd(ad);
        // We reuse the edit modal to set start/end date for approval
        setFormData({
            ...formData,
            title: ad.title,
            start_date: ad.start_date || new Date().toISOString(),
            end_date: ad.end_date || new Date(Date.now() + 7*24*60*60*1000).toISOString()
        });
        // We will repurpose modalVisible for Approval Date Range if actionAd is set
        setModalVisible(true);
    };

    const submitApproval = async () => {
        try {
            setSubmitting(true);
            const response = await fetch(\`\${API_BASE_URL}/vendorcreation/ads/\${actionAd.id}/approve\`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_date: formData.start_date, end_date: formData.end_date })
            });
            if (response.ok) {
                Alert.alert('Success', 'Ad Approved!');
                setModalVisible(false);
                setActionAd(null);
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
            const response = await fetch(\`\${API_BASE_URL}/vendorcreation/ads/\${actionAd.id}/disapprove\`, {
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
`;
c = c.replace(/const fetchAds = async \(\) => \{/, approveLogic + '\n    const fetchAds = async () => {');

// 7. Update Modal logic
const oldModalSubmit = `<TouchableOpacity
                                            style={styles.saveButton}
                                            onPress={handleSubmit}
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <ActivityIndicator color="#FFF" />
                                            ) : (
                                                <Text style={styles.saveButtonText}>
                                                    {editingId ? 'Update Ad' : 'Save Ad'}
                                                </Text>
                                            )}
                                        </TouchableOpacity>`;

const newModalSubmit = `<TouchableOpacity
                                            style={styles.saveButton}
                                            onPress={actionAd ? submitApproval : handleSubmit}
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <ActivityIndicator color="#FFF" />
                                            ) : (
                                                <Text style={styles.saveButtonText}>
                                                    {actionAd ? 'Confirm Approval' : (editingId ? 'Update Ad' : 'Save Ad')}
                                                </Text>
                                            )}
                                        </TouchableOpacity>`;
c = c.replace(oldModalSubmit, newModalSubmit);

// 8. Reject Modal UI
const rejectModalUI = `
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
`;
c = c.replace(/(<\/SafeAreaView>)/, rejectModalUI + '\n$1');

fs.writeFileSync('src/app/Ads.tsx', c);
console.log('Patched Admin Ads.tsx');
