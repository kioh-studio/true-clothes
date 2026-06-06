import React, { useEffect, useRef } from 'react';
import {
  View, StyleSheet, Animated, Pressable, ScrollView,
  Dimensions, ViewStyle,
} from 'react-native';
import { T } from '../../design/tokens';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number | string;
  height?: number | string;
  style?: ViewStyle;
}

export function BottomSheet({ open, onClose, children, maxHeight = '90%', style }: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [open]);

  if (!mounted) return null;

  const maxH = typeof maxHeight === 'string'
    ? (parseFloat(maxHeight) / 100) * SCREEN_H
    : maxHeight;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity }]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { maxHeight: maxH, transform: [{ translateY }] }, style]}
      >
        <View style={styles.handle} />
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.color.sheetDim,
  },
  sheet: {
    backgroundColor: T.color.canvas,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: T.color.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: T.color.tertiary,
    opacity: 0.5,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    flex: 1,
  },
});
