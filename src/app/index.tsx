import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Ad, Category, CouponStats, DashboardOrder, Vendor, countCategories, fetchDashboardResource, parseArray, parseCouponStats, parseOrders, summarizeOrders, summarizeVendors } from '../lib/dashboard';

const COLORS = { primary: '#FF5500', darkBg: '#111827', lightBg: '#F9FAFB', cardBg: '#FFFFFF', textDark: '#1F2937', textMuted: '#6B7280', greenSuccess: '#10B981', border: '#E5E7EB' };
const chartColors = ['#FF5500', '#3B82F6', '#10B981', '#8B5CF6', '#9CA3AF'];
type Profile = { id?: string | number; name?: string; email?: string; role?: string };
type Snapshot = { orders: DashboardOrder[] | null; ads: Ad[] | null; vendors: Vendor[] | null; categories: Category[] | null; coupons: CouponStats | null };
const emptySnapshot: Snapshot = { orders: null, ads: null, vendors: null, categories: null, coupons: null };

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const profileRequest = useRef(0);

  const readProfile = useCallback(async () => {
    const request = ++profileRequest.current;
    setProfileLoading(true);
    setProfileError('');
    try {
      const stored = await AsyncStorage.getItem('adminData');
      if (!stored) throw new Error('Account details are unavailable. Please sign in again.');
      const value = JSON.parse(stored);
      if (!value || typeof value !== 'object') throw new Error('Account details are unavailable. Please sign in again.');
      const next: Profile = {};
      for (const key of ['name', 'email', 'role'] as const) {
        if (typeof value[key] === 'string' && value[key].trim()) next[key] = value[key].trim();
      }
      if (typeof value.id === 'string' || typeof value.id === 'number') next.id = value.id;
      if (request === profileRequest.current) setProfile(next);
    } catch (error) {
      if (request === profileRequest.current) {
        setProfile(null);
        setProfileError(error instanceof Error ? error.message : 'Unable to read your profile.');
      }
    } finally {
      if (request === profileRequest.current) setProfileLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    const timeout = setTimeout(() => request.abort(), 20000);
    const results = await Promise.allSettled([
      fetchDashboardResource('/admin/orders', request.signal).then(parseOrders),
      fetchDashboardResource('/vendorcreation/ads', request.signal).then(parseArray<Ad>),
      fetchDashboardResource('/vendorcreation', request.signal).then(parseArray<Vendor>),
      fetchDashboardResource('/categories', request.signal).then(parseArray<Category>),
      fetchDashboardResource('/coupons/stats', request.signal).then(parseCouponStats),
    ]);
    clearTimeout(timeout);
    if (controller.current !== request) return;
    const [orders, ads, vendors, categories, coupons] = results;
    setData({
      orders: orders.status === 'fulfilled' ? orders.value : null,
      ads: ads.status === 'fulfilled' ? ads.value : null,
      vendors: vendors.status === 'fulfilled' ? vendors.value : null,
      categories: categories.status === 'fulfilled' ? categories.value : null,
      coupons: coupons.status === 'fulfilled' ? coupons.value : null,
    });
    const labels = ['orders', 'ads', 'vendors', 'categories', 'coupons'];
    setErrors(results.flatMap((result, index) => result.status === 'rejected' ? [labels[index]] : []));
    setUpdatedAt(results.some(result => result.status === 'fulfilled') ? new Date() : null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
    void readProfile();
    const interval = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 60000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { void refresh(); void readProfile(); }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      controller.current?.abort();
      controller.current = null;
      profileRequest.current++;
      setProfileOpen(false);
    };
  }, [refresh, readProfile]));

  const vendorsSummary = summarizeVendors(data.vendors || []);
  const summary = summarizeOrders(data.orders || [], data.categories || []);
  const categoryRows = data.orders ? summary.categories : (data.categories || []).map(category => ({ name: category.category_name, count: null }));
  const formatAmount = (amount: number, currency?: string) => {
    if (currency && /^[A-Z]{3}$/.test(currency)) return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const displayName = profile?.name || profile?.email || 'My profile';
  const unavailable = loading ? 'Loading…' : 'Unavailable';
  const metrics = [
    { label: 'Total Vendors', value: data.vendors?.length, detail: data.vendors ? vendorsSummary.pending + ' pending approval' : unavailable, icon: 'people-outline' as const, color: COLORS.primary, bg: '#FFF0EA', route: '/vendor-approval' as const },
    { label: 'Total Bookings', value: data.orders?.length, detail: 'Total orders', icon: 'calendar-outline' as const, color: COLORS.greenSuccess, bg: '#ECFDF5', route: '/orders' as const },
    { label: 'Total Revenue', value: data.orders && summary.revenue !== null ? formatAmount(summary.revenue, summary.currency) : undefined, detail: 'Paid / completed orders', icon: 'cash-outline' as const, color: '#3B82F6', bg: '#EFF6FF', route: '/orders' as const },
    { label: 'Total Categories', value: data.categories ? countCategories(data.categories) : undefined, detail: data.categories ? data.categories.length + ' main categories' : unavailable, icon: 'folder-open-outline' as const, color: COLORS.greenSuccess, bg: '#ECFDF5', route: '/category' as const },
    { label: 'Total Coupons', value: data.coupons?.total, detail: data.coupons ? data.coupons.pending + ' pending approval' : unavailable, icon: 'pricetag-outline' as const, color: '#3B82F6', bg: '#EFF6FF', route: '/coupon-approval' as const },
    { label: 'Total Ads', value: data.ads?.length, detail: data.ads ? data.ads.filter(ad => ad.is_active === true || ad.is_active === 1 || ad.is_active === '1').length + ' enabled' : unavailable, icon: 'megaphone-outline' as const, color: '#8B5CF6', bg: '#F5F3FF', route: '/Ads' as const },
  ];
  const maxCount = Math.max(1, ...summary.thisWeek, ...summary.lastWeek);
  const linePath = (values: number[]) => values.map((count, day) => (day === 0 ? 'M' : 'L') + (10 + day * 45) + ' ' + (100 - count / maxCount * 90)).join(' ');
  let offset = 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />
      <View style={styles.header} >
        <Image source={require('@/assets/images/Roameo-logo.png')} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open profile for ${displayName}`} style={styles.profileButton} onPress={() => { setProfileOpen(true); void readProfile(); }}>
          <Text numberOfLines={1} style={styles.profileName}>Profile: {displayName}</Text>
          <Ionicons name="person-circle-outline" size={32} color="#FFF" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={COLORS.primary} />}>
        <View style={styles.heading}>
          <View style={styles.flex}>
            <Text style={styles.pageTitle}>Dashboard</Text>
            <Text style={styles.pageSubtitle}>{profile?.name ? `Welcome back, ${profile.name}!` : 'Welcome back!'} Here is your latest overview.</Text>
            <Text style={styles.caption}>{loading ? 'Updating dashboard…' : updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Dashboard could not be updated'}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh dashboard" disabled={loading} onPress={refresh} style={styles.refresh}>
            {loading ? <ActivityIndicator color={COLORS.primary} /> : <Ionicons name="refresh-outline" size={22} color={COLORS.primary} />}
          </TouchableOpacity>
        </View>
        {errors.length > 0 && <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>Could not load {errors.join(', ')}. Check your connection and refresh to retry.</Text></View>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>
          {metrics.map(metric => <TouchableOpacity key={metric.label} accessibilityRole="button" style={styles.statCard} onPress={() => router.push(metric.route)}>
            <View style={[styles.iconCircle, { backgroundColor: metric.bg }]}><Ionicons name={metric.icon} size={18} color={metric.color} /></View>
            <Text style={styles.statValue}>{metric.value == null ? unavailable : metric.value.toLocaleString()}</Text>
            <Text style={styles.statLabel}>{metric.label}</Text>
            <Text style={styles.statTrend}>{metric.detail}</Text>
          </TouchableOpacity>)}
        </ScrollView>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Bookings Overview</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: COLORS.primary }]} /><Text style={styles.legendText}>This Week</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#CBD5E1' }]} /><Text style={styles.legendText}>Last Week</Text></View>
            </View>
          </View>
          {data.orders === null ? <View style={styles.chartWrapper}><Svg height={140} width="100%" viewBox="0 0 300 120"><Path d="M0 20 L300 20 M0 60 L300 60 M0 100 L300 100" stroke="#F1F5F9" strokeWidth={1} /></Svg><Text style={styles.chartNote}>{loading ? 'Loading orders…' : 'Order data is currently unavailable.'}</Text></View> : <View style={styles.chartWrapper}>
            <Svg height={140} width="100%" viewBox="0 0 300 120" accessibilityLabel="Daily orders this week and last week">
              <Path d="M0 20 L300 20 M0 60 L300 60 M0 100 L300 100" stroke="#F1F5F9" strokeWidth={1} />
              <Path d={linePath(summary.lastWeek)} fill="none" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="4,4" />
              <Path d={linePath(summary.thisWeek)} fill="none" stroke={COLORS.primary} strokeWidth={3} />
              {summary.thisWeek.map((count, day) => <Circle key={day} cx={10 + day * 45} cy={100 - count / maxCount * 90} r={3} fill={COLORS.primary} />)}
            </Svg>
            <View style={styles.chartAxisX}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <View key={day} style={styles.day}><Text style={styles.axisText}>{day}</Text><Text style={styles.axisText}>{summary.thisWeek[index] ?? '-'} / {summary.lastWeek[index]}</Text></View>)}</View>
            <Text style={styles.chartNote}>Orders per day - this week / last week</Text>
          </View>}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Categories</Text>
          <View style={styles.donutRow}>
            <Svg height={110} width={110} viewBox="0 0 40 40"><G transform="rotate(-90 20 20)">
              <Circle cx={20} cy={20} r={100 / (2 * Math.PI)} fill="transparent" stroke="#E5E7EB" strokeWidth={5} />
              {categoryRows.map((category, index) => {
                const share = data.orders?.length && category.count !== null ? category.count / data.orders.length * 100 : 0;
                const start = offset;
                offset += share;
                return share > 0 ? <Circle key={category.name} cx={20} cy={20} r={100 / (2 * Math.PI)} fill="transparent" stroke={chartColors[index % chartColors.length]} strokeWidth={5} strokeDasharray={share + ' ' + (100 - share)} strokeDashoffset={-start} /> : null;
              })}
            </G></Svg>
            <View style={styles.flex}>{categoryRows.map((category, index) => <View key={category.name} style={styles.categoryRow}>
              <View style={[styles.dot, { backgroundColor: chartColors[index % chartColors.length] }]} /><Text style={styles.catName}>{category.name}</Text><Text style={styles.catVal}>{data.orders?.length && category.count !== null ? Math.round(category.count / data.orders.length * 100) + '%' : '-'}</Text>
            </View>)}{categoryRows.length === 0 && <Text style={styles.caption}>{loading ? 'Loading categories…' : data.orders?.length === 0 ? 'No orders yet.' : 'Categories unavailable.'}</Text>}</View>
          </View>
          <Text style={styles.chartNote}>{data.orders ? 'Share of orders by category' : 'Category names are live. Order shares are unavailable.'}</Text>
        </View>
        <View style={styles.sectionHeader}><Text style={styles.cardTitle}>Recent Bookings</Text><TouchableOpacity accessibilityRole="button" onPress={() => router.push('/orders')}><Text style={styles.viewAllText}>View All</Text></TouchableOpacity></View>
        <View style={styles.recentList}>
          {data.orders === null ? <Text style={styles.empty}>{loading ? 'Loading orders…' : 'Order data is currently unavailable.'}</Text> : summary.recent.length === 0 ? <Text style={styles.empty}>No orders yet.</Text> : summary.recent.map(order => <TouchableOpacity accessibilityRole="button" key={order.id} style={styles.recentCard} onPress={() => router.push('/orders')}>
            <View style={styles.recentLeft}>
              <View style={styles.recentAvatar}><Ionicons name="calendar-outline" size={18} color="#A855F7" /></View>
              <View style={styles.flex}><Text numberOfLines={1} style={styles.recentTitle}>{order.title || 'Order #' + order.id}</Text><Text style={styles.recentDate}>{Number.isNaN(Date.parse(order.created_at)) ? 'Date unavailable' : new Date(order.created_at).toLocaleString()}</Text></View>
            </View>
            <View style={styles.bookingRight}>
              <Text style={styles.bookingAmount}>{formatAmount(order.total, order.currency)}</Text>
              <View style={[styles.badgePill, { backgroundColor: ['paid', 'completed', 'confirmed'].includes(order.status) ? '#DEF7EC' : '#FEF3C7' }]}><Text style={[styles.badgePillText, { color: '#374151' }]}>{order.status}</Text></View>
            </View>
          </TouchableOpacity>)}
        </View>
      </ScrollView>
      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}>
          <View style={styles.heading}><Text style={styles.title}>My Profile</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close profile" onPress={() => setProfileOpen(false)} style={styles.refresh}><Ionicons name="close" size={24} color={COLORS.textDark} /></TouchableOpacity></View>
          {profileLoading ? <ActivityIndicator color={COLORS.primary} style={styles.empty} /> : profileError ? <><Text accessibilityRole="alert" style={styles.errorText}>{profileError}</Text><TouchableOpacity accessibilityRole="button" onPress={readProfile}><Text style={styles.link}>Retry</Text></TouchableOpacity></> : <>
            <Ionicons name="person-circle-outline" size={64} color={COLORS.primary} />
            {([['Name', profile?.name], ['Email', profile?.email], ['Role', profile?.role], ['User ID', profile?.id]] as const).map(([label, value]) => <View key={label} style={styles.profileField}><Text style={styles.caption}>{label}</Text><Text selectable style={styles.body}>{value == null ? 'Not provided' : String(value)}</Text></View>)}
            <Text style={styles.caption}>Account details from your current sign-in.</Text>
          </>}
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bookingRight: { alignItems: 'flex-end', gap: 4 },
  bookingAmount: { fontSize: 13, fontWeight: 'bold', color: COLORS.textDark },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark },
  pageSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginVertical: 2 },
  statTrend: { fontSize: 10, color: COLORS.greenSuccess, fontWeight: '600' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' },
  legend: { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 10, color: COLORS.textMuted },
  chartWrapper: { alignItems: 'center', marginTop: 4 },
  chartAxisX: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 8, marginTop: 6 },
  day: { alignItems: 'center' },
  axisText: { fontSize: 10, color: COLORS.textMuted },
  chartNote: { fontSize: 10, color: COLORS.textMuted, marginTop: 8 },
  catName: { fontSize: 11, color: COLORS.textDark, flex: 1, marginLeft: 6, textTransform: 'capitalize' },
  catVal: { fontSize: 11, fontWeight: 'bold', color: COLORS.textDark },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 },
  viewAllText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  recentList: { gap: 10 },
  recentCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  recentLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentAvatar: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3E8FF' },
  recentTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  recentDate: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgePillText: { fontSize: 9, fontWeight: '600', textTransform: 'capitalize' },
  container: { flex: 1, backgroundColor: COLORS.lightBg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { minHeight: 56, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 16 },
  logo: { width: 110, height: 32, },
  profileButton: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, paddingVertical: 8 ,color:'black'},
  profileName: { color: 'black', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  content: { padding: 16, paddingBottom: 30 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  flex: { flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textDark },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, lineHeight: 19 },
  caption: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, lineHeight: 17 },
  body: { fontSize: 14, color: COLORS.textDark, lineHeight: 21 },
  refresh: { padding: 10 },
  metrics: { gap: 10, paddingBottom: 12 },
  statCard: { width: 135, backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 17, fontWeight: 'bold', color: COLORS.textDark },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.textDark },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  chart: { flexDirection: 'row', gap: 10, paddingVertical: 16 },
  barColumn: { flex: 1, alignItems: 'center' },
  barTrack: { height: 100, width: '65%', justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: COLORS.border, marginTop: 6 },
  bar: { backgroundColor: COLORS.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { paddingVertical: 20, color: COLORS.textMuted, lineHeight: 21 },
  link: { color: COLORS.primary, fontWeight: '600', paddingVertical: 8 },
  status: { fontSize: 12, color: COLORS.textMuted, backgroundColor: COLORS.lightBg, padding: 6, borderRadius: 8 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 440, borderRadius: 16, backgroundColor: '#FFF', padding: 24 },
  profileField: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
});