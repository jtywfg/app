import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

type ActionButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  secondary?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({ label, secondary = false, loading = false, style, ...props }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.secondaryButton,
        pressed && styles.pressed,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.violet : '#FFFFFF'} />
      ) : (
        <Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ScreenHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.headingTitle}>{title}</Text>
      {subtitle ? <Text style={styles.headingSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function SmallSectionLabel({ children }: React.PropsWithChildren) {
  return <Text style={styles.smallLabel}>{children}</Text>;
}

export const styles = StyleSheet.create({
  actionButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryButton: {
    backgroundColor: '#F0EDFF',
    borderWidth: 1,
    borderColor: '#DCD6FF',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryText: {
    color: colors.violetDark,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  heading: {
    gap: 5,
  },
  headingTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '800',
  },
  headingSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    backgroundColor: colors.violet,
    borderColor: colors.violet,
  },
  chipText: {
    color: '#625E6C',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  smallLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
