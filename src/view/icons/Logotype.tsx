import Svg, {Text as SvgText, type PathProps, type SvgProps} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'

const ratio = 26 / 145

export function Logotype({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const pal = usePalette('default')
  // @ts-expect-error fallback parse for numeric string
  const size = parseInt(String(rest.width || 100), 10)

  return (
    <Svg
      fill="none"
      viewBox="0 0 145 26"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <SvgText
        fill={fill || pal.text.color}
        x="0"
        y="19"
        fontSize="18"
        fontWeight="bold"
        letterSpacing="0.2">
        It's My Turn
      </SvgText>
    </Svg>
  )
}
