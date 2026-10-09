import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius } from '@/theme/tokens';

/**
 * Scaffold stand-in. Each screen's real content comes from its `render<Name>()`
 * in ../moria-enterprise-backend/prototypes/mobile/index.html.
 */
export function ScreenPlaceholder({ eyebrow, title, source }: { eyebrow?: string; title: string; source: string }) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: colors.background }}>
      {eyebrow ? (
        <Text variant="eyebrow" color={colors.onSurfaceVariant}>
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="headlineMd" color={colors.regalPlum}>
        {title}
      </Text>
      <View style={styles.card}>
        <Text color={colors.onSurfaceVariant}>Not built yet. Prototype reference: {source}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 4 },
  card: {
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
    padding: 20,
  },
});
