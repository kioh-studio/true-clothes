import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { T, type } from '../src/design/tokens';
import { COLOR_HEX } from '../src/data';
import { PrimaryButton, TextLink, Field, Tag } from '../src/components/ui';
import { IconChevronLeft, IconCamera, IconImage } from '../src/components/icons';
import { useAppStore } from '../src/stores/appStore';

const { width: W } = Dimensions.get('window');

const CATEGORIES = [
  'TEE', 'SHIRT', 'POLO', 'HENLEY', 'KNIT',
  'JEANS', 'TROUSERS', 'CHINOS',
  'JACKET', 'BLAZER', 'COAT',
  'SNEAKERS', 'LOAFERS',
  'BAG', 'CAP', 'BELT', 'SCARF',
];

const COLOR_NAMES = Object.keys(COLOR_HEX);

const MATERIALS = [
  'Cotton', 'Denim', 'Leather', 'Nylon', 'Wool',
  'Canvas', 'Linen', 'Polyester', 'Suede', 'Silk',
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

async function saveImageLocally(uri: string): Promise<string> {
  try {
    const dir = `${FileSystem.documentDirectory}wardrobe/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${dir}${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

export default function AddItemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useAppStore();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('TEE');
  const [color, setColor] = useState('White');
  const [material, setMaterial] = useState('Cotton');
  const [size, setSize] = useState('M');
  const [brand, setBrand] = useState('');

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, allowsEditing: true, aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      const local = await saveImageLocally(result.assets[0].uri);
      setImageUri(local);
    }
  };

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, allowsEditing: true, aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      const local = await saveImageLocally(result.assets[0].uri);
      setImageUri(local);
    }
  };

  const handleSave = () => {
    addItem({
      id: 'u_' + Date.now(),
      type: category,
      name: name || `${color} ${category.toLowerCase()}`,
      color,
      material,
      img: imageUri ?? undefined,
      tone: 0,
      wornCount: 0,
      addedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      brand: brand || undefined,
      size,
    });
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>Add item</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo area */}
        {imageUri ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
            <View style={styles.photoActions}>
              <Pressable onPress={launchCamera} style={styles.photoActionBtn}>
                <IconCamera size={16} color={T.color.canvas} strokeWidth={1.4} />
              </Pressable>
              <Pressable onPress={launchLibrary} style={styles.photoActionBtn}>
                <IconImage size={16} color={T.color.canvas} strokeWidth={1.4} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoLabel}>ADD A PHOTO</Text>
            <View style={{ height: 16 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={launchCamera} style={styles.photoMethodBtn}>
                <IconCamera size={20} color={T.color.primary} strokeWidth={1.2} />
                <Text style={styles.photoMethodText}>Camera</Text>
              </Pressable>
              <Pressable onPress={launchLibrary} style={styles.photoMethodBtn}>
                <IconImage size={20} color={T.color.primary} strokeWidth={1.2} />
                <Text style={styles.photoMethodText}>Library</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />

        {/* Name */}
        <Field label="NAME (OPTIONAL)" value={name} onChange={setName} placeholder="e.g. Oversized white tee" />

        <View style={{ height: 28 }} />

        {/* Category */}
        <Text style={styles.fieldLabel}>CATEGORY</Text>
        <View style={{ height: 8 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          {CATEGORIES.map(c => (
            <Tag key={c} selected={category === c} onPress={() => setCategory(c)} size="sm">{c}</Tag>
          ))}
        </ScrollView>

        <View style={{ height: 28 }} />

        {/* Color */}
        <Text style={styles.fieldLabel}>COLOR</Text>
        <View style={{ height: 8 }} />
        <View style={styles.colorGrid}>
          {COLOR_NAMES.map(c => (
            <Pressable key={c} onPress={() => setColor(c)}
              style={[styles.colorChip, color === c && styles.colorChipActive]}>
              <View style={[styles.colorDot, { backgroundColor: COLOR_HEX[c] }]} />
              <Text style={[styles.colorName, color === c && styles.colorNameActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 28 }} />

        {/* Material */}
        <Text style={styles.fieldLabel}>MATERIAL</Text>
        <View style={{ height: 8 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          {MATERIALS.map(m => (
            <Tag key={m} selected={material === m} onPress={() => setMaterial(m)} size="sm">{m}</Tag>
          ))}
        </ScrollView>

        <View style={{ height: 28 }} />

        {/* Size */}
        <Text style={styles.fieldLabel}>SIZE</Text>
        <View style={{ height: 8 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SIZES.map(s => (
            <Pressable key={s} onPress={() => setSize(s)}
              style={[styles.sizeBtn, size === s && styles.sizeBtnActive]}>
              <Text style={[styles.sizeText, size === s && styles.sizeTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 28 }} />

        {/* Brand */}
        <Field label="BRAND (OPTIONAL)" value={brand} onChange={setBrand} placeholder="e.g. Uniqlo" />

        <View style={{ height: 40 }} />

        <PrimaryButton onPress={handleSave}>ADD TO WARDROBE</PrimaryButton>
        <View style={{ height: 16 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={() => router.back()} color={T.color.tertiary}>Cancel</TextLink>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },

  photoPlaceholder: {
    width: '100%', aspectRatio: 4 / 3,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  photoLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  photoMethodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 20,
    borderWidth: 0.5, borderColor: T.color.hairlineStrong,
  },
  photoMethodText: { fontFamily: T.font.sans, fontSize: 13, color: T.color.primary },

  photoContainer: { width: '100%', aspectRatio: 4 / 3, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoActions: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', gap: 8,
  },
  photoActionBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: 'rgba(26,24,21,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  fieldLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10,
    borderWidth: 0.5, borderColor: T.color.hairline,
  },
  colorChipActive: { borderColor: T.color.primary, backgroundColor: T.color.elevated },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 0.5, borderColor: T.color.hairline },
  colorName: { fontFamily: T.font.sans, fontSize: 12, color: T.color.secondary },
  colorNameActive: { color: T.color.primary },

  sizeBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: T.color.hairline,
  },
  sizeBtnActive: { borderColor: T.color.primary, backgroundColor: T.color.primary },
  sizeText: { fontFamily: T.font.sansMedium, fontSize: 13, color: T.color.secondary },
  sizeTextActive: { color: T.color.canvas },
});
