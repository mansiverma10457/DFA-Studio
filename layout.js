export function getStatePosition(index, count) {
  const radius = Math.max(130, Math.min(280, count * 30))
  const angle = (2 * Math.PI * index) / Math.max(count, 1) - Math.PI / 2
  return {
    x: Math.round(360 + Math.cos(angle) * radius),
    y: Math.round(280 + Math.sin(angle) * radius),
  }
}

export function getAutoLayoutPositions(states) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(states.length)))
  const spacingX = 190
  const spacingY = 160
  const width = (columns - 1) * spacingX
  const rows = Math.ceil(states.length / columns)
  const height = (rows - 1) * spacingY

  return Object.fromEntries(states.map((state, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    return [
      state.id,
      {
        x: Math.round(360 - width / 2 + column * spacingX),
        y: Math.round(280 - height / 2 + row * spacingY),
      },
    ]
  }))
}
