import {View} from 'react-native'
import {Image} from 'expo-image'

import {flatten, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

type Props = {
  fill?: string
  width?: number | string
  height?: number | string
  style?: any
} & Record<string, any>

export function LogomarkWithType({
  fill,
  width = 180,
  height,
  style,
  ...rest
}: Props) {
  const t = useTheme()
  const styles = flatten(style)

  const numericWidth = parseInt(String(width || 180), 10)
  const iconSize = Math.min(30, Math.round(numericWidth * 0.18)) || 28

  const tintColor =
    fill === 'sky'
      ? t.palette.primary_500
      : fill || styles?.color || (t.scheme === 'dark' ? '#FFFFFF' : t.palette.primary_500)

  const textColor =
    fill === 'sky'
      ? t.palette.primary_500
      : fill || styles?.color || t.atoms.text.color

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        styles,
      ]}
      accessibilityLabel="It's My Turn"
      {...rest}>
      <Image
        source={require('../../../assets/app-icons/android_icon_default_next.png')}
        contentFit="contain"
        accessibilityIgnoresInvertColors
        style={{
          width: iconSize,
          height: iconSize,
          tintColor,
        }}
      />
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          letterSpacing: 0.2,
          color: textColor,
        }}>
        It's My Turn
      </Text>
    </View>
  )
}
