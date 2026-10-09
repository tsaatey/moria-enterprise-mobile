import { Image } from 'expo-image';
import { View } from 'react-native';

import { radius } from '@/theme/tokens';

const ASPECT = 2920 / 1500;

/** The gold logo sits on a black plate everywhere in the prototype. */
export function Logo({ height = 56, plate = true }: { height?: number; plate?: boolean }) {
  const pad = Math.round(height / 4);
  return (
    <View
      style={
        plate
          ? { backgroundColor: '#000', borderRadius: height > 32 ? radius.xl : radius.lg, paddingHorizontal: pad + 4, paddingVertical: pad / 2, alignSelf: 'center' }
          : { alignSelf: 'flex-start' }
      }>
      <Image
        source={require('@/assets/images/moria-logo.png')}
        style={{ height, width: height * ASPECT }}
        contentFit="contain"
        accessibilityLabel="Moria Enterprise"
      />
    </View>
  );
}
