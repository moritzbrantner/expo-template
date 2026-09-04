import {
  WARDROBE_FITS,
  WARDROBE_FORMALITY_LEVELS,
  normalizeWardrobeText,
  type WardrobeFit,
  type WardrobeFormality,
  type WardrobeItem,
} from './wardrobe';

export type WardrobeSimilarityAvailability = {
  category: boolean;
  color: boolean;
  materials: boolean;
  seasons: boolean;
  occasions: boolean;
  formality: boolean;
  fit: boolean;
  tags: boolean;
  name: boolean;
};

export type WardrobeSimilarity = {
  total: number;
  category: number;
  color: number;
  materials: number;
  seasons: number;
  occasions: number;
  formality: number;
  fit: number;
  tags: number;
  name: number;
  available: WardrobeSimilarityAvailability;
};

export type RelatedWardrobeItem = {
  item: WardrobeItem;
  similarity: WardrobeSimilarity;
};

const WEIGHTS = {
  category: 0.28,
  color: 0.12,
  materials: 0.13,
  seasons: 0.1,
  occasions: 0.12,
  formality: 0.08,
  fit: 0.05,
  tags: 0.08,
  name: 0.04,
} as const;

type SimilaritySignal = keyof typeof WEIGHTS;
const SIMILARITY_SIGNALS = Object.keys(WEIGHTS) as SimilaritySignal[];

const COLOR_FAMILIES: readonly (readonly string[])[] = [
  ['black', 'charcoal'],
  ['white', 'cream', 'ivory'],
  ['grey', 'gray', 'silver'],
  ['beige', 'tan', 'camel'],
  ['brown', 'chocolate'],
  ['navy', 'blue', 'light blue', 'denim'],
  ['green', 'olive', 'mint'],
  ['red', 'burgundy', 'maroon'],
  ['pink', 'rose'],
  ['purple', 'violet', 'lilac'],
  ['yellow', 'gold', 'mustard'],
  ['orange', 'rust'],
];

function tokens(value: string) {
  return normalizeWardrobeText(value)
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .filter(Boolean);
}

function jaccard(leftValues: readonly string[], rightValues: readonly string[]) {
  const left = new Set(leftValues);
  const right = new Set(rightValues);
  const union = new Set([...left, ...right]);
  if (union.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }
  return intersection / union.size;
}

function colorSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeWardrobeText(left).toLocaleLowerCase();
  const normalizedRight = normalizeWardrobeText(right).toLocaleLowerCase();
  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const sameFamily = COLOR_FAMILIES.some(
    (family) => family.includes(normalizedLeft) && family.includes(normalizedRight),
  );
  return sameFamily ? 0.5 : 0;
}

function ordinalSimilarity<T extends string>(left: T, right: T, order: readonly T[]) {
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  if (leftIndex < 0 || rightIndex < 0 || order.length <= 1) {
    return 0;
  }

  const distance = Math.abs(leftIndex - rightIndex);
  return Math.max(0, 1 - distance / (order.length - 1));
}

function formalitySimilarity(left: WardrobeFormality, right: WardrobeFormality) {
  return ordinalSimilarity(left, right, WARDROBE_FORMALITY_LEVELS);
}

function fitSimilarity(left: WardrobeFit, right: WardrobeFit) {
  return ordinalSimilarity(left, right, WARDROBE_FITS);
}

function weightedTotal(
  scores: Record<SimilaritySignal, number>,
  available: Record<SimilaritySignal, boolean>,
) {
  let numerator = 0;
  let denominator = 0;

  for (const signal of SIMILARITY_SIGNALS) {
    if (!available[signal]) {
      continue;
    }
    numerator += scores[signal] * WEIGHTS[signal];
    denominator += WEIGHTS[signal];
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

export function wardrobeSimilarity(
  left: WardrobeItem,
  right: WardrobeItem,
): WardrobeSimilarity {
  const scores: Record<SimilaritySignal, number> = {
    category: left.category === right.category ? 1 : 0,
    color: colorSimilarity(left.color, right.color),
    materials: jaccard(left.materials, right.materials),
    seasons: jaccard(left.seasons, right.seasons),
    occasions: jaccard(left.occasions, right.occasions),
    formality:
      left.formality && right.formality
        ? formalitySimilarity(left.formality, right.formality)
        : 0,
    fit: left.fit && right.fit ? fitSimilarity(left.fit, right.fit) : 0,
    tags: jaccard(left.tags, right.tags),
    name: jaccard(tokens(left.name), tokens(right.name)),
  };
  const available: Record<SimilaritySignal, boolean> = {
    category: true,
    color: true,
    materials: left.materials.length > 0 && right.materials.length > 0,
    seasons: left.seasons.length > 0 && right.seasons.length > 0,
    occasions: left.occasions.length > 0 && right.occasions.length > 0,
    formality: left.formality !== null && right.formality !== null,
    fit: left.fit !== null && right.fit !== null,
    tags: left.tags.length > 0 && right.tags.length > 0,
    name: true,
  };

  return {
    total: weightedTotal(scores, available),
    ...scores,
    available,
  };
}

function compareStableText(left: string, right: string) {
  const normalizedLeft = normalizeWardrobeText(left).toLocaleLowerCase();
  const normalizedRight = normalizeWardrobeText(right).toLocaleLowerCase();
  if (normalizedLeft < normalizedRight) {
    return -1;
  }
  if (normalizedLeft > normalizedRight) {
    return 1;
  }
  return 0;
}

export function rankRelatedItems(
  items: readonly WardrobeItem[],
  sourceId: string,
  limit = 3,
): RelatedWardrobeItem[] {
  if (limit <= 0) {
    return [];
  }

  const source = items.find((item) => item.id === sourceId);
  if (!source) {
    return [];
  }

  return items
    .filter((item) => item.id !== sourceId)
    .map((item) => ({ item, similarity: wardrobeSimilarity(source, item) }))
    .filter((candidate) => candidate.similarity.total > 0)
    .sort((left, right) => {
      const scoreOrder = right.similarity.total - left.similarity.total;
      if (scoreOrder !== 0) {
        return scoreOrder;
      }

      const nameOrder = compareStableText(left.item.name, right.item.name);
      if (nameOrder !== 0) {
        return nameOrder;
      }
      return compareStableText(left.item.id, right.item.id);
    })
    .slice(0, limit);
}
