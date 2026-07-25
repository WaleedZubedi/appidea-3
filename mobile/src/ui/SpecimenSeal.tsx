import Svg, {
  Circle,
  Defs,
  G,
  Path,
  Text as SvgText,
  TextPath,
} from 'react-native-svg';

import { fonts } from '@/theme';

/** two-leaf sprout mark, reused in the seal + divider */
export function Sprout({ size = 16, color = '#a9d182' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 22 V12" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M12 13 C7 13 4 10 4 6 C9 6 12 9 12 13 Z" fill={color} />
      <Path d="M12 13 C17 13 20 10 20 6 C15 6 12 9 12 13 Z" fill={color} />
    </Svg>
  );
}

/** circular "Specimen Nº01 · Cubus sproutii" wax-seal badge */
export function SpecimenSeal({ size = 92 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const ring = size / 2 - 1.5;
  const textR = ring - 8.5;
  const cream = 'rgba(238,229,210,0.92)';
  const topPath = `M ${cx - textR} ${cy} A ${textR} ${textR} 0 0 1 ${cx + textR} ${cy}`;
  const botPath = `M ${cx - textR} ${cy} A ${textR} ${textR} 0 0 0 ${cx + textR} ${cy}`;

  return (
    <Svg width={size} height={size}>
      <Defs>
        <Path id="seal-top" d={topPath} fill="none" />
        <Path id="seal-bot" d={botPath} fill="none" />
      </Defs>
      <Circle cx={cx} cy={cy} r={ring} stroke={cream} strokeWidth={1} fill="none" />
      <SvgText fill={cream} fontSize={7.4} fontFamily={fonts.mono} letterSpacing={1.1}>
        <TextPath href="#seal-top" startOffset="50%" textAnchor="middle">
          SPECIMEN Nº01
        </TextPath>
      </SvgText>
      <SvgText fill={cream} fontSize={7.4} fontFamily={fonts.mono} letterSpacing={1.1}>
        <TextPath href="#seal-bot" startOffset="50%" textAnchor="middle">
          CUBUS SPROUTII
        </TextPath>
      </SvgText>
      {/* side separator dots */}
      <Circle cx={cx - textR + 0.5} cy={cy} r={1} fill={cream} />
      <Circle cx={cx + textR - 0.5} cy={cy} r={1} fill={cream} />
      {/* center sprout */}
      <G x={cx - 8} y={cy - 8}>
        <Path d="M8 15 V9" stroke={cream} strokeWidth={1.1} strokeLinecap="round" />
        <Path d="M8 10 C4.5 10 2.5 8 2.5 5 C6 5 8 7 8 10 Z" fill={cream} />
        <Path d="M8 10 C11.5 10 13.5 8 13.5 5 C10 5 8 7 8 10 Z" fill={cream} />
      </G>
    </Svg>
  );
}
