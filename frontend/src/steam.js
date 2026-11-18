// Steam's own review-summary scale (rules published by Valve), from percent positive and review count.
export function steamLabel(percent, total) {
  if (!total || total < 10) return ''
  if (percent >= 80) return percent >= 95 && total >= 500 ? 'Overwhelmingly Positive' : total >= 50 ? 'Very Positive' : 'Positive'
  if (percent >= 70) return 'Mostly Positive'
  if (percent >= 40) return 'Mixed'
  if (percent >= 20) return 'Mostly Negative'
  return total >= 500 ? 'Overwhelmingly Negative' : total >= 50 ? 'Very Negative' : 'Negative'
}

export const steamTone = (percent) => (percent >= 70 ? 'positive' : percent >= 40 ? 'neutral' : 'negative')
