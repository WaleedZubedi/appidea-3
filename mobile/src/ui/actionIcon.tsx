/**
 * Shared action icons + colors, used by the Home rails and the Journal log so
 * they always match. `ActionGlyph` renders the right icon for a care-event kind.
 */
import { Image } from 'expo-image';
import { Text } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const CREAM = '#f5efe3';

export const IC = {
  water: require('../../assets/images/icon-water.png'),
  feed: require('../../assets/images/icon-feed.png'),
  heart: require('../../assets/images/icon-heart.png'),
};

export const ACTION_COLOR: Record<string, string> = {
  water: '#63a9d6', feed: '#e0a94a', pet: '#e090b5', shower: '#5cc0b4',
  books: '#c9a2e0', stretch: '#8fcf9a', scroll: '#7fa8d0', sun: '#f0c94a', daily: '#f0895f',
};

export function ShowerIcon({ size = 28, color = CREAM }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 3.5v3c0 1.4 1.1 2.5 2.5 2.5H10.6" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 9.4H18L15.2 12.7H8.8L6 9.4Z" fill={color} />
      <Path d="M9.4 15v2M12 15.4v2.3M14.6 15v2" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
export function BooksIcon({ size = 28, color = CREAM }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 6c-2-1.2-4.5-1.5-7-1v12c2.5-.5 5-.2 7 1 2-1.2 4.5-1.5 7-1V5c-2.5-.5-5-.2-7 1Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M12 6v12" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}
export function StretchIcon({ size = 28, color = CREAM }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={4.6} r={2.1} fill={color} />
      <Path d="M12 7.4v6.4M12 8.6l-3.4-3M12 8.6l3.4-3M12 13.8l-3 5.4M12 13.8l3 5.4" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function ScrollIcon({ size = 28, color = CREAM }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={6.5} y={2.5} width={11} height={19} rx={3} stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v5.5m0 0l-2-2m2 2l2-2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={18.4} r={0.9} fill={color} />
    </Svg>
  );
}
export function SunIcon({ size = 28, color = CREAM }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4.2} stroke={color} strokeWidth={1.9} />
      <Path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

/** render the homepage icon for a care-event kind (used in the journal log). */
export function ActionGlyph({ kind, size = 26 }: { kind: string; size?: number }) {
  const color = ACTION_COLOR[kind] ?? CREAM;
  switch (kind) {
    case 'water': return <Image source={IC.water} style={{ width: size, height: size }} contentFit="contain" />;
    case 'feed': return <Image source={IC.feed} style={{ width: size, height: size }} contentFit="contain" />;
    case 'pet': return <Image source={IC.heart} style={{ width: size, height: size }} contentFit="contain" />;
    case 'shower': return <ShowerIcon size={size} color={color} />;
    case 'books': return <BooksIcon size={size} color={color} />;
    case 'stretch': return <StretchIcon size={size} color={color} />;
    case 'scroll': return <ScrollIcon size={size} color={color} />;
    case 'sun': return <SunIcon size={size} color={color} />;
    case 'daily': return <Text style={{ fontSize: size * 0.82 }}>✨</Text>;
    default: return <Text style={{ fontSize: size * 0.7, color }}>·</Text>;
  }
}
