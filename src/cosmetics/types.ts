export type MineVariant = 'classic' | 'pixel' | 'gem' | 'void'
export type VictoryVariant = 'confetti' | 'sparkles' | 'fireworks'

export type MarketItemBase = {
  id: number
  slug: string
  name: string
  priceCoins: number
  owned: boolean
  equipped: boolean
  proOnly: boolean
}

export type MarketMineSkin = MarketItemBase & { variant: MineVariant }
export type MarketVictoryEffect = MarketItemBase & { variant: VictoryVariant }
export type MarketProfileFlair = MarketItemBase & {
  frameClass: string
  badgeEmoji: string
}

export type CosmeticKind = 'theme' | 'mine_skin' | 'victory_effect' | 'profile_flair'
