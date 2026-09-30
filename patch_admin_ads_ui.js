const fs = require('fs');
let c = fs.readFileSync('src/app/Ads.tsx', 'utf8');

// 1. Fix selectedTab and add vendorAdType
c = c.replace(/const \[selectedTab, setSelectedTab\] = useState\('.*?'\);/, 
  "const [selectedTab, setSelectedTab] = useState('vendor');\n    const [vendorAdType, setVendorAdType] = useState('featured');");

// 2. Fix useEffect dependencies for filtering
c = c.replace(/\[ads, selectedTab, searchQuery\]/g, "[ads, selectedTab, searchQuery, vendorAdType]");
c = c.replace(/applyFilters\(ads, selectedTab, searchQuery\);/g, "applyFilters(ads, selectedTab, searchQuery, vendorAdType);");

// 3. Fix applyFilters logic
c = c.replace(/const applyFilters = \(adsData, tab, search\) => \{/, "const applyFilters = (adsData, tab, search, vType) => {");
c = c.replace(/let filtered = adsData\.filter\(ad => ad\.ad_type === tab\);/, 
  "let filtered = adsData.filter(ad => ad.ad_type === tab);\n        if (tab === 'vendor') {\n            filtered = filtered.filter(ad => ad.campaign_type === vType);\n        }");

// 4. Inject toggle UI for Vendor Ad Type right below the tabs
const toggleUI = `
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
`;
c = c.replace(/(<View style=\{styles\.controlsRow\}>)/, toggleUI + '\n                $1');

// 5. Fix action row to include approve/reject buttons
const oldActionRowRegex = /<View style=\{styles\.actionRow\}>[\s\S]*?<\/View>/;
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

c = c.replace(oldActionRowRegex, newActionRow);

// 6. Fix stats row to show correct approval counts
const oldStatsRegex = /<View style=\{styles\.statsRow\}>[\s\S]*?<\/View>\s*<\/View>\s*<\/View>/; // match the stats row until the end of the container
const newStats = `<View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{filteredAds.length}</Text>
                        <Text style={styles.statLabel}>Total Ads</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: COLORS.greenSuccess }]}>
                            {filteredAds.filter(ad => ad.approval_status === 'approved').length}
                        </Text>
                        <Text style={styles.statLabel}>Approved</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: '#F59E0B' }]}>
                            {filteredAds.filter(ad => ad.approval_status === 'pending').length}
                        </Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                </View>`;
c = c.replace(/<View style=\{styles\.statsRow\}>[\s\S]*?(?=<View style=\{styles\.listContainer\})/, newStats + '\n                ');

fs.writeFileSync('src/app/Ads.tsx', c);
console.log('Fixed tabs and approve/reject buttons in admin panel');
