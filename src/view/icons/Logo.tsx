import {forwardRef} from 'react'
import {type TextProps} from 'react-native'
import {Image} from 'expo-image'

import {flatten, useTheme} from '#/alf'

type Props = {
  allowVariants?: boolean
  fill?: string
  style?: TextProps['style']
  width?: number | string
  height?: number | string
}

export const Logo = forwardRef(function LogoImpl(props: Props, ref) {
  const t = useTheme()
  const {fill, style, ...rest} = props
  const styles = flatten(style)

  // Resolve size from width or height props, defaulting to standard 32px
  const size = parseInt(String(rest.width || rest.height || 32), 10)

  // Color resolver: handles gradient alias, custom fills, text color, or theme palette
  const tintColor =
    fill === 'sky'
      ? t.palette.primary_500
      : fill || styles?.color || (t.scheme === 'dark' ? '#FFFFFF' : t.palette.primary_500)

  return (
    <Image
      // @ts-expect-error forwardRef compatibility with expo-image
      ref={ref}
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
        styles,
      ]}
    />
  )
})
