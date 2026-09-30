import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_BASE_URL = `${process.env.EXPO_PUBLIC_BASE_URL}/api`;

// Helper function to handle CORS
const fetchWithCors = (url: string, options: RequestInit = {}) => fetch(url, options);

const COLORS = {
    primary: '#FF5500',
    darkBg: '#111827',
    lightBg: '#F9FAFB',
    cardBg: '#FFFFFF',
    textDark: '#1F2937',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    redError: '#EF4444',
};

interface LoginScreenProps {
    onLoginSuccess?: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
    const [name, setName] = useState('');

    const handleSubmit = async () => {
        // Validate inputs
        if (isSignup && !name.trim()) {
            Alert.alert('Error', 'Please enter your name');
            return;
        }

        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }

        if (!password.trim()) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        if (isSignup && password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const endpoint = isSignup ? '/admin/auth/signup' : '/admin/auth/login';
            const url = `${API_BASE_URL}${endpoint}`;
            
            const body: any = {
                email: email.trim(),
                password: password.trim(),
            };

            if (isSignup) {
                body.name = name.trim();
                body.role = 'admin';
            }

            console.log('Sending request to:', url);

            const response = await fetchWithCors(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                // Save token and user data
                const account = data.data.admin || data.data.user || data.data;
                if (typeof data.data.token !== 'string' || !data.data.token) {
                    throw new Error('The server did not return a valid login session.');
                }
                await AsyncStorage.setItem('adminData', JSON.stringify({
                    id: account.id,
                    name: account.name || (isSignup ? name.trim() : undefined),
                    email: account.email || email.trim(),
                    role: account.role,
                }));
                await AsyncStorage.setItem('adminToken', data.data.token);

                // IMPORTANT: Call the callback BEFORE showing alert
                // This ensures the parent component updates immediately
                if (onLoginSuccess) {
                    onLoginSuccess();
                }

                // Show success message
                Alert.alert(
                    'Success', 
                    isSignup ? 'Account created successfully!' : 'Login successful!',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                // The parent component will handle navigation
                            }
                        }
                    ]
                );
            } else {
                throw new Error(data.message || 'Something went wrong');
            }
        } catch (error: any) {
            console.error('Auth error:', error);
            Alert.alert('Error', error.message || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />

            <View style={styles.content}>
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require('@/assets/images/Roameo-logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.title}>
                        {isSignup ? 'Create Account' : 'Welcome Back'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {isSignup 
                            ? 'Sign up to manage your Roameo admin panel' 
                            : 'Sign in to manage your Roameo admin panel'}
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
                    {isSignup && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={20} color={COLORS.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your full name"
                                    placeholderTextColor={COLORS.textMuted}
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your email"
                                placeholderTextColor={COLORS.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder={isSignup ? "Create a password (min 6 chars)" : "Enter your password"}
                                placeholderTextColor={COLORS.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons 
                                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                                    size={20} 
                                    color={COLORS.textMuted} 
                                />
                            </TouchableOpacity>
                        </View>
                        {!isSignup && (
                            <TouchableOpacity style={styles.forgotPassword}>
                                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <Text style={styles.submitButtonText}>
                                {isSignup ? 'Create Account' : 'Sign In'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.switchMode}
                        onPress={() => {
                            setIsSignup(!isSignup);
                            setPassword('');
                            setName('');
                        }}
                    >
                        <Text style={styles.switchModeText}>
                            {isSignup 
                                ? 'Already have an account? Sign In' 
                                : "Don't have an account? Sign Up"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.lightBg,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 150,
        height: 45,
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.textDark,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textMuted,
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textDark,
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.lightBg,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 48,
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        color: COLORS.textDark,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginTop: 6,
    },
    forgotPasswordText: {
        fontSize: 12,
        color: COLORS.primary,
        fontWeight: '500',
    },
    submitButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 10,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    switchMode: {
        marginTop: 16,
        alignItems: 'center',
    },
    switchModeText: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '500',
    },
});
