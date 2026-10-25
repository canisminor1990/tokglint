import { Pressable, StyleSheet, Text } from 'react-native';

import { createStyles, useTheme } from '@/theme';

const useStyles = createStyles((token) => ({
  label: { color: token.colorTextLightSolid, fontFamily: 'PingFang SC', fontSize: token.fontSize },
}));

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    borderRadius: 8,
    outline: 'none',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

export const Button = ({ children, onPress }: { children: string; onPress?: () => void }) => {
  const theme = useTheme();
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.root, { backgroundColor: theme.colorPrimary }]}
      onPress={onPress}
    >
      <Text style={s.label}>{children}</Text>
    </Pressable>
  );
};
