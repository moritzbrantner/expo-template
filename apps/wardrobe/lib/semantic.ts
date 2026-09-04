import type { WardrobeItem } from './wardrobe';
import { normalizeWardrobeText } from './wardrobe';

export type WardrobeSimilarity = {
  total: number;
  category: number;
  color: number;
  tags: number;
  name: number;
};

export type RelatedWardrobeItem = {
  item: WardrobeItem;
  similarity: WardrobeSimilarity;
};

const WEIGHTS = {
  category: 0.45,
  color: 0.2,
  tags: 0.25,
  name: 0.1,
} as const;

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

export function wardrobeSimilarity(
  left: WardrobeItem,
  right: WardrobeItem,
): WardrobeSimilarity {
  const category = left.category === right.category ? 1 : 0;
  const color = colorSimilarity(left.color, right.color);
  const tags = jaccard(left.tags, right.tags);
  const name = jaccard(tokens(left.name), tokens(right.name));
  const total =
    category * WEIGHTS.category +
    color * WEIGHTS.color +
    tags * WEIGHTS.tags +
    name * WEIGHTS.name;

  return { total, category, color, tags, name };
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
