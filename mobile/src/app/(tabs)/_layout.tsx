import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';

const ACTIVE = '#ffffff';
const INACTIVE = 'rgba(255,255,255,0.5)';

function Home({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function Sprout({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M12 21V10" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 12C6.5 12 3 8.5 3 4c5.5 0 9 3.5 9 8Z" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
      <Path d="M12 13c5 0 8-3 8-7-5 0-8 3-8 7Z" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}
function Book({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M5 5a2 2 0 0 1 2-2h11v16H7a2 2 0 0 0-2 2Z" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
      <Path d="M5 19a2 2 0 0 1 2-2h11" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
function Person({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

const ICONS: Record<string, (p: { color: string }) => React.ReactElement> = {
  index: Home,
  journal: Book,
  growth: Sprout,
  you: Person,
};

function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Home (index) sits on a dark image → light glass; other tabs are light pages → dark glass
  const onDarkPage = state.routes[state.index]?.name === 'index';
  const activeColor = onDarkPage ? ACTIVE : '#ffffff';
  const inactiveColor = onDarkPage ? INACTIVE : 'rgba(255,255,255,0.55)';
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
      <View style={[styles.bar, onDarkPage ? styles.barLight : styles.barDark]}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const Icon = ICONS[route.name];
          if (!Icon) return null;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} onPress={onPress} hitSlop={6} style={styles.item}>
              <View style={[styles.iconWrap, focused && (onDarkPage ? styles.iconWrapActive : styles.iconWrapActiveDark)]}>
                <Icon color={focused ? activeColor : inactiveColor} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="journal" />
      <Tabs.Screen name="growth" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'stretch' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  barLight: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.22)',
    shadowOpacity: 0.35,
  },
  barDark: {
    backgroundColor: 'rgba(20,14,8,0.82)',
    borderColor: 'rgba(255,255,255,0.10)',
    shadowOpacity: 0.5,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 50,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  iconWrapActiveDark: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
});
