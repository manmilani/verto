import React from 'react'
import type { DeliveryMapBundle } from '@verto/core'
import { PriorityEditor } from './PriorityEditor.js'
import { Stack, Text } from '../components/ui.js'

interface Props {
  bundle: DeliveryMapBundle
  onFocusJourney: (id: string) => void
}

export function JourneysLens({ bundle, onFocusJourney }: Props) {
  const hasJourneys = bundle.graph.nodes.some(n => n.isDeliverySlice)
  return (
    <Stack gap={20} style={{ padding: 24, maxWidth: 1320, margin: '0 auto' }}>
      {hasJourneys
        ? <PriorityEditor bundle={bundle} onFocusJourney={onFocusJourney} />
        : <Text tone="secondary">No journeys (delivery slices) in this project.</Text>}
    </Stack>
  )
}
