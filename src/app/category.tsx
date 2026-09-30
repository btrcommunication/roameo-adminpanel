import { Ionicons } from '@expo/vector-icons';
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
} from "react-native";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_BASE_URL}/api`;

// Helper function to handle CORS
const fetchWithCors = async (url, options = {}) => {
    const CORS_PROXY = 'https://corsproxy.io/?';
    
    try {
        console.log('Attempting direct fetch to:', url);
        const response = await fetch(url, options);
        console.log('Direct fetch response status:', response.status);
        return response;
    } catch (error) {
        console.log('Direct fetch failed, trying with proxy...');
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
        console.log('Proxy URL:', proxyUrl);
        const response = await fetch(proxyUrl, options);
        console.log('Proxy fetch response status:', response.status);
        return response;
    }
};

// Theme Palette
const COLORS = {
  primary: '#FF5500',
  darkBg: '#111827',
  lightBg: '#F9FAFB',
  cardBg: '#FFFFFF',
  textDark: '#1F2937',
  textMuted: '#6B7280',
  greenSuccess: '#10B981',
  redError: '#EF4444',
  border: '#E5E7EB',
};

// Types
interface Category {
  id: number;
  category_name: string;
  parent_id: number | null;
  level: number;
  image_url: string | null;
  display_order: number;
  sub_divisions?: Category[];
}

interface CategoryFormData {
  category_name: string;
  image_url: string;
  image_base64?: string | null;
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CategoryFormData>({
    category_name: '',
    image_url: '',
    image_base64: null,
  });

  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      setError(null);
      const url = `${API_BASE_URL}/categories`;
      console.log('Fetching categories from:', url);
      
      const response = await fetchWithCors(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Categories response:', result);
      
      if (result.status === 'success') {
        setCategories(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch categories');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load categories');
      Alert.alert('Error', 'Failed to load categories. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories();
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      category_name: '',
      image_url: '',
      image_base64: null,
    });
    setEditingId(null);
  };

  // Open modal for adding/editing
  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      category_name: category.category_name,
      image_url: category.image_url || '',
      image_base64: null,
    });
    setModalVisible(true);
  };

  // Pick image from gallery and convert to base64
  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to upload icons.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setFormData({ 
          ...formData, 
          image_base64: asset.base64 || null,
          image_url: asset.uri // Preview the image
        });
      }
    } catch (error) {
      console.error('Image pick error:', error);
      Alert.alert('Error', 'Failed to pick icon');
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.category_name.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    setSubmitting(true);
    setError(null);
    
    try {
      // Prepare data for API
      const submitData: any = {
        category_name: formData.category_name.trim(),
        level: 1,           // default kept for backend compatibility
        display_order: 0,   // default kept for backend compatibility
      };

      // If there's a new image (base64), send it directly
      if (formData.image_base64) {
        submitData.image_base64 = formData.image_base64;
      } else if (formData.image_url && !formData.image_base64) {
        // If editing and keeping existing image
        submitData.image_url = formData.image_url;
      }

      const url = editingId 
        ? `${API_BASE_URL}/categories/${editingId}`
        : `${API_BASE_URL}/categories`;
      
      const method = editingId ? 'PUT' : 'POST';

      console.log('Submitting to:', url);
      console.log('Method:', method);
      console.log('Data:', submitData);

      const response = await fetchWithCors(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        const text = await response.text();
        console.error('Response error:', text);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'success') {
        Alert.alert('Success', editingId ? 'Category updated successfully' : 'Category added successfully');
        setModalVisible(false);
        resetForm();
        fetchCategories(); // Refresh the list
      } else {
        throw new Error(result.message || 'Failed to save category');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save category');
      Alert.alert('Error', 'Failed to save category. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete with confirmation
 const handleDelete = (id: number, categoryName: string) => {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${categoryName}"?`
    );

    if (confirmed) {
      performDelete(id, categoryName);
    }
  } else {
    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${categoryName}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => performDelete(id, categoryName),
        },
      ]
    );
  }
};

  // Perform the actual delete API call
  const performDelete = async (id: number, categoryName: string) => {
    try {
      setDeletingId(id);
      setError(null);
      
      // Try different URL formats
      const urls = [
        `${API_BASE_URL}/categories/${id}`,
        `${API_BASE_URL}/categories/delete/${id}`,
        `${API_BASE_URL}/categories/${id}/delete`,
      ];
      
      let lastError = null;
      
      for (const url of urls) {
        try {
          console.log('Attempting delete at:', url);
          
          const response = await fetchWithCors(url, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
          
          console.log('Delete response status:', response.status);
          
          if (response.ok) {
            const result = await response.json();
            console.log('Delete response:', result);
            
            if (result.status === 'success') {
              Alert.alert('Success', `"${categoryName}" has been deleted successfully`);
              // Refresh the list
              await fetchCategories();
              setDeletingId(null);
              return;
            } else {
              // If status is not success but response is ok
              throw new Error(result.message || 'Failed to delete category');
            }
          } else {
            // If response is not ok, try to get error message
            const text = await response.text();
            console.log('Error response text:', text);
            lastError = `Status ${response.status}: ${text}`;
          }
        } catch (error) {
          console.error('Delete attempt failed:', error);
          lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }
      
      // If all attempts failed
      throw new Error(lastError || 'Failed to delete category after multiple attempts');
      
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to delete category. Please try again.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Render category item with proper hierarchy
  const renderCategoryItem = (category: Category, level: number = 0) => {
    const paddingLeft = level * 20;
    const isDeleting = deletingId === category.id;
    
    return (
      <View key={category.id}>
        <View style={[styles.card, { marginLeft: paddingLeft }]}>
          <View style={styles.cardContent}>
            {category.image_url ? (
              <Image
                source={{ uri: category.image_url }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.cardImage, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={30} color={COLORS.textMuted} />
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <View style={styles.nameContainer}>
                  <Text style={styles.cardTitle}>{category.category_name}</Text>
                </View>
                {/* <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {category.sub_divisions?.length || 0} sub-items
                  </Text>
                </View> */}
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  onPress={() => openEditModal(category)}
                  style={styles.actionBtn}
                  disabled={isDeleting}
                >
                  <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    console.log('Delete button clicked for:', category.id);
                    handleDelete(category.id, category.category_name);
                  }}
                  style={styles.actionBtn}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={COLORS.redError} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color={COLORS.redError} />
                      <Text style={styles.deleteText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        
        {/* Render sub-categories recursively */}
        {category.sub_divisions && category.sub_divisions.length > 0 && (
          <View>
            {category.sub_divisions.map(sub => renderCategoryItem(sub, level + 1))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.darkBg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/images/Roameo-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBadgeBtn}>
            <Ionicons name="notifications-outline" size={22} color="#FFF" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>6</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Ionicons name="person-circle" size={32} color="#FFF" />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeHeader}>
            <View>
              <Text style={styles.pageTitle}>Category Management</Text>
              <Text style={styles.pageSubtitle}>
                Manage your product categories
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={openAddModal}
            >
              <Ionicons name="add" size={24} color="#FFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={24} color={COLORS.redError} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchCategories}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Category List */}
        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-outline" size={60} color={COLORS.textMuted} />
            <Text style={styles.emptyStateTitle}>No Categories Found</Text>
            <Text style={styles.emptyStateText}>
              Click the "Add" button to create your first category
            </Text>
          </View>
        ) : (
          categories.map(category => renderCategoryItem(category))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
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
                {editingId ? 'Edit Category' : 'Add New Category'}
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
              <Text style={styles.label}>Category Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Electronics, Sports, etc."
                placeholderTextColor={COLORS.textMuted}
                value={formData.category_name}
                onChangeText={(text) => setFormData({ ...formData, category_name: text })}
              />

              <Text style={styles.label}>Category Icon</Text>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={pickImage}
              >
                <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                <Text style={styles.imagePickerText}>
                  {formData.image_url && !formData.image_base64 ? 'Change Icon' : 'Upload Icon from Computer'}
                </Text>
              </TouchableOpacity>

              {formData.image_url && (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: formData.image_url }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setFormData({ ...formData, image_url: '', image_base64: null })}
                  >
                    <Ionicons name="close-circle" size={24} color={COLORS.redError} />
                  </TouchableOpacity>
                </View>
              )}

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
                      {editingId ? 'Save Changes' : 'Add Category'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 110,
    height: 32,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadgeBtn: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    width: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  avatar: {
    marginLeft: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  pageSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE8E8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.redError,
  },
  errorText: {
    flex: 1,
    color: COLORS.redError,
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
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F3F4F6',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  nameContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  levelBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  levelBadgeText: {
    color: '#4338CA',
    fontSize: 9,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeText: {
    color: '#4338CA',
    fontSize: 9,
    fontWeight: '500',
  },
  cardDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 4,
  },
  editText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  deleteText: {
    color: COLORS.redError,
    fontWeight: '600',
    fontSize: 12,
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
});