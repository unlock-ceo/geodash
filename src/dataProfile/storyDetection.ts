// ---------------------------------------------------------------------------
// Story Detection — classify dataset for auto-visualization
// ---------------------------------------------------------------------------

import type { DataProfile, StoryType } from './types';

/**
 * Detect the best visualization story type for a dataset profile.
 */
export function detectStory(profile: DataProfile): StoryType {
  // Temporal: has a temporal field
  if (profile.temporalField) {
    return 'temporal';
  }

  // Magnitude: has a clear numeric field (e.g., earthquake magnitude)
  const magnitudeFields = ['mag', 'magnitude', 'value', 'intensity', 'score', 'count', 'population'];
  const hasMagnitude = profile.numericFields.some((f) =>
    magnitudeFields.includes(f.toLowerCase()),
  );
  if (hasMagnitude) {
    return 'magnitude';
  }

  // Categorical: has categorical fields
  if (profile.categoricalFields.length > 0) {
    return 'categorical';
  }

  // Density: many points, no distinguishing fields
  if (profile.rowCount > 50) {
    return 'density';
  }

  return 'simple';
}
