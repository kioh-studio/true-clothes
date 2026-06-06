import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, FlatList, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { T, type } from '../../src/design/tokens';
import { OUTFITS, ClothingItem, PHOTOS } from '../../src/data';
import { BottomNav } from '../../src/components/ui/BottomNav';
import { BottomSheet, PrimaryButton, SecondaryButton, TextLink, Tag, Field, Photo } from '../../src/components/ui';
import { IconSearch, IconPlus, IconChevronLeft, IconCamera, IconImage, IconReceipt, IconChevronRight } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 24 * 2 - 12) / 2;

const FILTERS = ['ALL', 'TOPS', 'BOTTOMS', 'OUTERWEAR', 'FOOTWEAR', 'ACCESSORIES'];
const FILTER_TYPES: Record<string, string[]> = {
  TOPS: ['SHIRT', 'KNIT', 'TEE', 'POLO', 'HENLEY'],
  BOTTOMS: ['JEANS', 'TROUSERS', 'CHINOS'],
  OUTERWEAR: ['BLAZER', 'COAT', 'JACKET'],
  FOOTWEAR: ['LOAFERS', 'SNEAKERS'],
  ACCESSORIES: ['BELT', 'SCARF', 'BAG', 'WATCH', 'NECKLACE', 'SUNGLASSES', 'CAP'],
};

function ItemCard({ item, onPress }: { item: ClothingItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.itemCard, { width: CARD_W }]}>
      <View style={styles.itemThumb}>
        {item.png ? (
          <Image source={item.png} style={styles.itemImg} resizeMode="contain" />
        ) : item.img ? (
          <Image source={{ uri: item.img }} style={styles.itemImg} resizeMode="cover" />
        ) : (
          <Text style={styles.itemTypeFallback}>{item.type}</Text>
        )}
      </View>
      <View style={{ padding: 4, paddingTop: 12 }}>
        <Text style={styles.itemType}>{item.type}</Text>
        <View style={{ height: 4 }} />
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <View style={{ height: 4 }} />
        <Text style={styles.itemMeta}>Worn {item.wornCount}× · Added {item.addedDate}</Text>
      </View>
    </Pressable>
  );
}

export default function WardrobeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, addItem } = useAppStore();
  const [filter, setFilter] = useState('ALL');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = filter === 'ALL' ? items
    : items.filter(i => (FILTER_TYPES[filter] || []).includes(i.type));

  const visible = search
    ? filtered.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  const counts: Record<string, number> = { ALL: items.length };
  Object.keys(FILTER_TYPES).forEach(f => {
    counts[f] = items.filter(i => (FILTER_TYPES[f] || []).includes(i.type)).length;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => setSearchOpen(v => !v)} style={styles.iconBtn}>
          <IconSearch size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>Wardrobe</Text>
        <Pressable onPress={() => setAddOpen(true)} style={styles.iconBtn}>
          <IconPlus size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      {searchOpen && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
          <Field label="" value={search} onChange={setSearch} placeholder="Search items…" autoFocus />
        </View>
      )}

      {/* Filter bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomWidth: 0.5, borderBottomColor: T.color.hairline }]}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 8, alignItems: 'center' }}>
        {FILTERS.map(f => (
          <Tag key={f} selected={filter === f} onPress={() => setFilter(f)} size="sm">
            {f} ({counts[f] || 0})
          </Tag>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No items yet.</Text>
            <Text style={styles.emptyCaption}>Start by adding what you already own.</Text>
            <View style={{ height: 32 }} />
            <PrimaryButton onPress={() => setAddOpen(true)} fullWidth={false} style={{ paddingHorizontal: 48 }}>
              ADD FIRST ITEM
            </PrimaryButton>
          </View>
        ) : (
          <View style={styles.grid}>
            {visible.map(item => (
              <ItemCard key={item.id} item={item} onPress={() => router.push(`/item/${item.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB — navigates to full add-item screen */}
      <Pressable onPress={() => router.push('/add-item' as any)} style={[styles.fab, { bottom: insets.bottom + 88 }]}>
        <IconPlus size={24} color={T.color.canvas} strokeWidth={1.4} />
      </Pressable>

      <BottomNav active="wardrobe" onChange={(tab) => {
        if (tab === 'home') router.replace('/(tabs)');
        if (tab === 'profile') router.replace('/(tabs)/profile');
      }} onMenu={() => setMenuOpen(true)} />

      <AddItemSheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={(item) => {
        addItem({
          id: 'u_' + Date.now(),
          type: (item.type || 'ITEM').toUpperCase(),
          name: item.name || 'New item',
          color: item.color || 'Beige',
          material: item.material,
          img: item.img,
          tone: 0,
          wornCount: 0,
          addedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        });
      }} />
    </View>
  );
}

async function saveImageLocally(uri: string): Promise<string> {
  try {
    const dir = `${FileSystem.documentDirectory}wardrobe/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${dir}${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri; // fallback to original URI
  }
}

const SIMULATED_ATTRS = {
  type: 'Blazer', color: 'Beige', material: 'Linen',
  pattern: 'Solid', occasion: 'Smart casual', season: 'Spring, Summer',
};

function AddItemSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (item: any) => void }) {
  const [step, setStep] = useState<'method' | 'processing' | 'review'>('method');
  const [name, setName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setTimeout(() => { setStep('method'); setName(''); setImageUri(null); }, 500);
  }, [open]);

  const pickAndProcess = async (uri: string) => {
    const local = await saveImageLocally(uri);
    setImageUri(local);
    setStep('processing');
    setTimeout(() => setStep('review'), 2200);
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      await pickAndProcess(result.assets[0].uri);
    }
  };

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      await pickAndProcess(result.assets[0].uri);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight={step === 'method' ? '60%' : '92%'}>
      {step === 'method' && (
        <View style={{ padding: 24 }}>
          <Text style={{ fontFamily: T.font.serif, fontSize: 28, color: T.color.primary }}>Add an item</Text>
          <View style={{ height: 24 }} />
          {[
            { icon: <IconCamera size={28} color={T.color.primary} strokeWidth={1.2} />, title: 'Take a photo', desc: 'AI extracts attributes', action: launchCamera },
            { icon: <IconImage size={28} color={T.color.primary} strokeWidth={1.2} />, title: 'Upload from library', desc: 'Multiple items in one go', action: launchLibrary },
            { icon: <IconReceipt size={28} color={T.color.primary} strokeWidth={1.2} />, title: 'Import from order history', desc: 'Connect Shopee, Lazada, or others', action: () => {} },
          ].map((o, i) => (
            <Pressable key={i} onPress={o.action} style={styles.methodRow}>
              {o.icon}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: T.font.serif, fontSize: 17, color: T.color.primary }}>{o.title}</Text>
                <Text style={{ ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 4 }}>{o.desc}</Text>
              </View>
              <IconChevronRight size={14} color={T.color.tertiary} strokeWidth={1.4} />
            </Pressable>
          ))}
        </View>
      )}
      {step === 'processing' && (
        <View style={{ padding: 24, alignItems: 'center' }}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: '100%', aspectRatio: 3 / 4 }} resizeMode="cover" />
          ) : (
            <Photo src={PHOTOS.detail_2} label="ANALYZING" tone={3} style={{ width: '100%', aspectRatio: 3 / 4 }} />
          )}
          <View style={{ height: 32 }} />
          <Text style={{ ...type.ui, fontSize: 11, color: T.color.primary }}>ANALYZING…</Text>
        </View>
      )}
      {step === 'review' && (
        <View style={{ padding: 24 }}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: '100%', aspectRatio: 5 / 3 }} resizeMode="cover" />
          ) : (
            <Photo src={PHOTOS.detail_2} label="ITEM" tone={3} style={{ width: '100%', aspectRatio: 5 / 3 }} />
          )}
          <View style={{ height: 24 }} />
          {Object.entries(SIMULATED_ATTRS).map(([k, v], i, arr) => (
            <View key={k} style={[styles.attrRow, { borderBottomWidth: i === arr.length - 1 ? 0 : 0.5, borderBottomColor: T.color.hairline }]}>
              <Text style={{ ...type.ui, fontSize: 10, color: T.color.tertiary, width: 100 }}>{k.toUpperCase()}</Text>
              <Text style={{ fontFamily: T.font.sans, fontSize: 15, color: T.color.primary }}>{v}</Text>
            </View>
          ))}
          <View style={{ height: 32 }} />
          <Field label="GIVE IT A NAME (OPTIONAL)" value={name} onChange={setName} placeholder="Beige linen blazer" />
          <View style={{ height: 32 }} />
          <PrimaryButton onPress={() => {
            onAdded({ ...SIMULATED_ATTRS, name, img: imageUri ?? undefined });
            onClose();
          }}>ADD TO WARDROBE</PrimaryButton>
          <View style={{ height: 16 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={onClose} color={T.color.tertiary}>Cancel</TextLink>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },
  filterBar: { maxHeight: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemCard: { marginBottom: 4 },
  itemThumb: {
    width: '100%', aspectRatio: 3 / 4,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center', padding: 16,
    overflow: 'hidden',
  },
  itemImg: { width: '100%', height: '100%' },
  itemTypeFallback: { ...type.micro, fontSize: 11, color: T.color.tertiary, textAlign: 'center', lineHeight: 14 },
  itemType: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  itemName: { fontFamily: T.font.serif, fontSize: 15, fontWeight: '400', color: T.color.primary },
  itemMeta: { ...type.caption, fontSize: 11, color: T.color.tertiary },
  emptyState: { paddingVertical: 64, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { ...type.h2, color: T.color.primary },
  emptyCaption: { ...type.caption, marginTop: 12, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 24,
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: T.color.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8,
    elevation: 8, zIndex: 5,
  },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, marginBottom: 12,
    borderWidth: 0.5, borderColor: T.color.hairlineStrong, borderRadius: 2,
  },
  attrRow: { flexDirection: 'row', alignItems: 'center', height: 56 },
});
