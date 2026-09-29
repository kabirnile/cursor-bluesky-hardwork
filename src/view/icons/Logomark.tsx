import {Image} from 'expo-image'
import {type SvgProps} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'

export function Logomark({
  fill,
  style,
  ...rest
}: {fill?: any} & SvgProps) {
  const pal = usePalette('default')
  const size = parseInt(String(rest.width || rest.height || 32), 10)
  const tintColor = typeof fill === 'string' ? fill : pal.text.color

  return (
    <Image
      source={require('../../../assets/app-icons/android_icon_default_next.png')}
      accessibilityLabel="It's My Turn"
      accessibilityHint=""
      accessibilityIgnoresInvertColors
      contentFit="contain"
      style={[
        {
          width: size,
          height: size,
          tintColor,
        },
        style,
      ]}
    />
  )
}
