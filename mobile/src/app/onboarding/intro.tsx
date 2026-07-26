import { ImageBackground } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fonts } from '@/theme';
import { IS_ONLINE } from '@/lib/config';

const CREAM = '#f5efe3';
const ACCENT = '#f0895f';

const SLIDES = [
  { img: require('../../../assets/images/onboard1.jpg'), title: 'One pet,\ntwo of you', body: 'Bixi blooms when you both show up — and won’t make it without you both.' },
  { img: require('../../../assets/images/onboard2.jpg'), title: 'Show up,\nhe thrives', body: 'Feed him, water him, love him. Just a moment a day.' },
  { img: require('../../../assets/images/onboard3.jpg'), title: 'Cared for,\nalways', body: 'Even on the quiet days, he’s tucked in and waiting for you.' },
];

export default function Intro() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];
  const done = () => router.push(IS_ONLINE ? '/onboarding/auth' : '/onboarding/gate');
  const next = () => (last ? done() : setI(i + 1));

  return (
    <ImageBackground source={slide.img} style={styles.root} contentFit="cover" contentPosition="center" transition={250}>
      <LinearGradient
        colors={['rgba(16,11,6,0.35)', 'rgba(16,11,6,0)', 'rgba(14,9,5,0.55)', 'rgba(11,7,4,0.97)']}
        locations={[0, 0.3, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <Pressable onPress={done} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.content}>
          <View style={styles.dots}>
            {SLIDES.map((_, idx) => (
              <View key={idx} style={[styles.dot, idx === i && styles.dotOn]} />
            ))}
          </View>
          <Text style={styles.title}>
            {slide.title}
            <Text style={{ color: ACCENT }}>.</Text>
          </Text>
          <Text style={styles.body}>{slide.body}</Text>

          <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} onPress={next}>
            <Text style={styles.btnLabel}>{last ? 'Get started' : 'Next'}</Text>
            <Svg width={20} height={20} viewBox="0 0 24 24" style={{ marginLeft: 8 }}>
              <Path d="M4 12H19M13 6l6 6-6 6" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e0a06' },
  safe: { flex: 1, paddingHorizontal: 26 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 8 },
  skip: { fontFamily: fonts.sansSemibold, fontSize: 15, color: 'rgba(245,239,227,0.65)' },

  content: { paddingBottom: 20 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(245,239,227,0.35)' },
  dotOn: { backgroundColor: ACCENT, width: 22 },

  title: { fontFamily: fonts.serifSemibold, fontSize: 46, lineHeight: 50, color: CREAM, letterSpacing: -0.6 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: 'rgba(245,239,227,0.85)', marginTop: 12, maxWidth: 330 },

  btn: {
    marginTop: 28, height: 58, borderRadius: 29, backgroundColor: '#c8502e',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#e0673f', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  btnPressed: { backgroundColor: '#a93f22', transform: [{ scale: 0.99 }] },
  btnLabel: { fontFamily: fonts.sansSemibold, fontSize: 18, color: '#fff', letterSpacing: 0.2 },
});
