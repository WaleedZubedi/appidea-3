/**
 * Top-level error boundary — a render/lifecycle crash anywhere in the tree shows
 * this friendly fallback (with a "Try again") instead of a white screen, and
 * reports the error to PostHog. Error boundaries must be class components.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/theme';
import { track } from '@/lib/analytics';

const BG = '#181009';
const CREAM = '#f5efe3';
const DIM = 'rgba(245,239,227,0.6)';
const ACCENT = '#f0895f';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    try { track('app_error', { message: String(error?.message ?? error) }); } catch {}
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.emoji}>🌱</Text>
        <Text style={styles.title}>Something went sideways</Text>
        <Text style={styles.body}>Bixi's okay — the app just hit a snag. Give it another try.</Text>
        <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]} onPress={this.reset}>
          <Text style={styles.btnTxt}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 10 },
  emoji: { fontSize: 44, marginBottom: 4 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 22, color: CREAM, textAlign: 'center' },
  body: { fontFamily: fonts.sans, fontSize: 15, color: DIM, textAlign: 'center', lineHeight: 22 },
  btn: {
    marginTop: 14, paddingHorizontal: 28, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT,
  },
  btnTxt: { fontFamily: fonts.sansBold, fontSize: 16, color: '#1a120a' },
});
