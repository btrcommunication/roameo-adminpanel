import { Ionicons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, TouchableOpacity, View } from 'react-native';

// Import LoginScreen from components
import LoginScreen from '../components/LoginScreen';

const BRAND_ORANGE = '#FF5500';
const DARK_BG = '#111827';

export default function AppTabs() {
  const router = useRouter();
  const segments = useSegments();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('adminToken');
      setIsAuthenticated(!!token);
      console.log('Auth check - Token exists:', !!token);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    console.log('Login success callback called');
    checkAuth();
  };

  const performLogout = async () => {
    try {
      // Clear all auth data
      await Promise.all([
        AsyncStorage.removeItem('adminToken'),
        AsyncStorage.removeItem('adminData'),
      ]);
      
      // Set authentication to false
      setIsAuthenticated(false);
      
      // Navigate to root and reset the navigation stack
      router.replace('/');
      
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        await performLogout();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: performLogout,
          },
        ]
      );
    }
  };

  // Show loading state
  if (loading) {
    return null;
  }

  // If not authenticated, render the LoginScreen directly
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // If authenticated, render the tabs with logout button
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: BRAND_ORANGE,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: DARK_BG,
          borderTopWidth: 0,
          height: 85,
          paddingTop: 8,
          paddingBottom: 22,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: DARK_BG,
        },
        headerTitleStyle: {
          color: '#FFF',
          fontWeight: 'bold',
        },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity 
              onPress={handleLogout}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="log-out-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          href: null,
        }}
      />
       <Tabs.Screen
        name="vendor-approval"
        options={{
          title: 'Vendors',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="category"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-open-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="coupon-approval"
        options={{
          title: 'Coupons',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pricetag-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Ads"
        options={{
          title: 'Ads',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="bullhorn" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="shopping-bag" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="revenue"
        options={{
          title: 'Revenue',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ads-approval"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
