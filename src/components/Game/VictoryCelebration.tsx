import type { VictoryVariant } from '../../cosmetics/types'
import { Confetti } from './Confetti'
import { Fireworks } from './Fireworks'
import { Sparkles } from './Sparkles'

export function VictoryCelebration(props: { variant?: VictoryVariant }) {
  const variant = props.variant ?? 'confetti'
  if (variant === 'sparkles') return <Sparkles />
  if (variant === 'fireworks') return <Fireworks />
  return <Confetti />
}
