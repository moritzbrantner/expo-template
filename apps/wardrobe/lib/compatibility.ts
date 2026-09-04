import {
  WARDROBE_FORMALITY_LEVELS,
  normalizeWardrobeText,
  type WardrobeCategory,
  type WardrobeFormality,
  type WardrobeItem,
} from './wardrobe';

export const WARDROBE_RELATIONS_STORAGE_KEY = '@expo-template/wardrobe/relations-v1';
export const WARDROBE_RELATION_KINDS = ['pairs-with', 'layered-with'] as const;

export type WardrobeRelationKind = (typeof WARDROBE_RELATION_KINDS)[number];

export type WardrobeRelation = {
  id: string;
  kind: WardrobeRelationKind;
  leftId: string;
  rightId: string;
  createdAt: string;
};

export type WardrobeCompatibility = {
  total: number;
  category: number;
  seasons: number;
  occasions: number;
  formality: number;
  pairsWith: boolean;
  layeredWith: boolean;
  reasons: string[];
};

export type OutfitSuggestion = {
  id: string;
  items: WardrobeItem[];
  score: number;
  reasons: string[];
};

function stableText(value: string) {
  return normalizeWardrobeText(value).toLocaleLowerCase();
}

function compareStable(left: string, right: string) {
  const a = stableText(left);
  const b = stableText(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalPair(leftId: string, rightId: string) {
  const left = normalizeWardrobeText(leftId);
  const right = normalizeWardrobeText(rightId);
  if (!left || !right) {
    throw new Error('Wardrobe relation item ids cannot be empty.');
  }
  if (left === right) {
    throw new Error('Wardrobe relation cannot connect an item to itself.');
  }
  return compareStable(left, right) <= 0 ? [left, right] as const : [right, left] as const;
}

export function wardrobeRelationId(kind: WardrobeRelationKind, leftId: string, rightId: string) {
  if (!WARDROBE_RELATION_KINDS.includes(kind)) {
    throw new Error('Wardrobe relation kind is invalid.');
  }
  const [left, right] = canonicalPair(leftId, rightId);
  return `${kind}:${encodeURIComponent(left)}:${encodeURIComponent(right)}`;
}

export function createWardrobeRelation(
  kind: WardrobeRelationKind,
  leftId: string,
  rightId: string,
  now = new Date(),
): WardrobeRelation {
  const [left, right] = canonicalPair(leftId, rightId);
  return {
    id: wardrobeRelationId(kind, left, right),
    kind,
    leftId: left,
    rightId: right,
    createdAt: now.toISOString(),
  };
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isRelationKind(value: unknown): value is WardrobeRelationKind {
  return typeof value === 'string' && WARDROBE_RELATION_KINDS.includes(value as WardrobeRelationKind);
}

export function deserializeWardrobeRelations(
  value: string | null,
  validItemIds?: readonly string[],
): WardrobeRelation[] {
  if (!value) {
    return [];
  }

  const validIds = validItemIds ? new Set(validItemIds.map(normalizeWardrobeText)) : null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const deduped = new Map<string, WardrobeRelation>();
    for (const candidate of parsed) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }
      const relation = candidate as Partial<WardrobeRelation>;
      if (
        !isRelationKind(relation.kind) ||
        typeof relation.leftId !== 'string' ||
        typeof relation.rightId !== 'string' ||
        !isIsoTimestamp(relation.createdAt)
      ) {
        continue;
      }

      let left: string;
      let right: string;
      try {
        [left, right] = canonicalPair(relation.leftId, relation.rightId);
      } catch {
        continue;
      }
      if (validIds && (!validIds.has(left) || !validIds.has(right))) {
        continue;
      }

      const normalized: WardrobeRelation = {
        id: wardrobeRelationId(relation.kind, left, right),
        kind: relation.kind,
        leftId: left,
        rightId: right,
        createdAt: relation.createdAt,
      };
      const previous = deduped.get(normalized.id);
      if (!previous || normalized.createdAt < previous.createdAt) {
        deduped.set(normalized.id, normalized);
      }
    }

    return [...deduped.values()].sort(
      (left, right) => compareStable(left.id, right.id) || left.createdAt.localeCompare(right.createdAt),
    );
  } catch {
    return [];
  }
}

export function hasWardrobeRelation(
  relations: readonly WardrobeRelation[],
  kind: WardrobeRelationKind,
  leftId: string,
  rightId: string,
) {
  const id = wardrobeRelationId(kind, leftId, rightId);
  return relations.some((relation) => relation.id === id);
}

export function toggleWardrobeRelation(
  relations: readonly WardrobeRelation[],
  kind: WardrobeRelationKind,
  leftId: string,
  rightId: string,
  now = new Date(),
) {
  const id = wardrobeRelationId(kind, leftId, rightId);
  if (relations.some((relation) => relation.id === id)) {
    return relations.filter((relation) => relation.id !== id);
  }
  return [...relations, createWardrobeRelation(kind, leftId, rightId, now)].sort((left, right) =>
    compareStable(left.id, right.id),
  );
}

export function canLayer(left: WardrobeItem, right: WardrobeItem) {
  const categories = new Set([left.category, right.category]);
  return categories.has('outerwear') && (categories.has('tops') || categories.has('one-piece'));
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

function ordinalSimilarity<T extends string>(left: T, right: T, order: readonly T[]) {
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  if (leftIndex < 0 || rightIndex < 0 || order.length <= 1) {
    return 0;
  }
  return Math.max(0, 1 - Math.abs(leftIndex - rightIndex) / (order.length - 1));
}

function formalitySimilarity(left: WardrobeFormality, right: WardrobeFormality) {
  return ordinalSimilarity(left, right, WARDROBE_FORMALITY_LEVELS);
}

function categoryCompatibility(left: WardrobeCategory, right: WardrobeCategory) {
  if (left === right) {
    return 0;
  }
  const pair = new Set([left, right]);
  if (pair.has('tops') && pair.has('bottoms')) return 1;
  if (pair.has('outerwear') && (pair.has('tops') || pair.has('one-piece'))) return 0.95;
  if (pair.has('one-piece') && pair.has('footwear')) return 0.9;
  if (pair.has('footwear') && (pair.has('tops') || pair.has('bottoms') || pair.has('outerwear'))) return 0.8;
  if (pair.has('outerwear') && pair.has('bottoms')) return 0.7;
  if (pair.has('accessories')) return 0.6;
  return 0.25;
}

export function wardrobeCompatibility(
  left: WardrobeItem,
  right: WardrobeItem,
  relations: readonly WardrobeRelation[] = [],
): WardrobeCompatibility {
  const category = categoryCompatibility(left.category, right.category);
  const seasons = jaccard(left.seasons, right.seasons);
  const occasions = jaccard(left.occasions, right.occasions);
  const formality =
    left.formality && right.formality ? formalitySimilarity(left.formality, right.formality) : 0;

  const weighted: Array<[number, number, boolean]> = [
    [category, 0.55, true],
    [seasons, 0.15, left.seasons.length > 0 && right.seasons.length > 0],
    [occasions, 0.2, left.occasions.length > 0 && right.occasions.length > 0],
    [formality, 0.1, left.formality !== null && right.formality !== null],
  ];
  let numerator = 0;
  let denominator = 0;
  for (const [score, weight, available] of weighted) {
    if (available) {
      numerator += score * weight;
      denominator += weight;
    }
  }
  let total = denominator === 0 ? 0 : numerator / denominator;

  const pairsWith = hasWardrobeRelation(relations, 'pairs-with', left.id, right.id);
  const layeredWith = canLayer(left, right) && hasWardrobeRelation(relations, 'layered-with', left.id, right.id);
  if (pairsWith) total += (1 - total) * 0.28;
  if (layeredWith) total += (1 - total) * 0.2;

  const reasons: string[] = [];
  if (pairsWith) reasons.push('explicit pair');
  if (layeredWith) reasons.push('explicit layer');
  if (category >= 0.8) reasons.push('complementary categories');
  if (seasons > 0) reasons.push('shared season');
  if (occasions > 0) reasons.push('shared occasion');
  if (formality >= 2 / 3) reasons.push('compatible formality');

  return { total, category, seasons, occasions, formality, pairsWith, layeredWith, reasons };
}

function templatesFor(category: WardrobeCategory): WardrobeCategory[][] {
  switch (category) {
    case 'tops':
    case 'bottoms':
      return category === 'tops'
        ? [['bottoms', 'footwear'], ['bottoms', 'footwear', 'outerwear']]
        : [['tops', 'footwear'], ['tops', 'footwear', 'outerwear']];
    case 'outerwear':
      return [['tops', 'bottoms', 'footwear'], ['one-piece', 'footwear']];
    case 'one-piece':
      return [['footwear'], ['footwear', 'outerwear']];
    case 'footwear':
      return [['tops', 'bottoms'], ['one-piece'], ['tops', 'bottoms', 'outerwear']];
    case 'accessories':
      return [['tops', 'bottoms', 'footwear'], ['one-piece', 'footwear']];
  }
}

function cartesian<T>(groups: readonly T[][]): T[][] {
  if (groups.length === 0) return [[]];
  let combinations: T[][] = [[]];
  for (const group of groups) {
    if (group.length === 0) return [];
    const next: T[][] = [];
    for (const prefix of combinations) {
      for (const value of group) {
        next.push([...prefix, value]);
      }
    }
    combinations = next;
  }
  return combinations;
}

function outfitScore(items: readonly WardrobeItem[], relations: readonly WardrobeRelation[]) {
  let total = 0;
  let count = 0;
  const reasons = new Set<string>();
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const compatibility = wardrobeCompatibility(items[left], items[right], relations);
      total += compatibility.total;
      count += 1;
      compatibility.reasons.forEach((reason) => reasons.add(reason));
    }
  }
  return {
    score: count === 0 ? 0 : total / count,
    reasons: [...reasons].slice(0, 5),
  };
}

export function suggestOutfits(
  items: readonly WardrobeItem[],
  sourceId: string,
  relations: readonly WardrobeRelation[] = [],
  limit = 3,
): OutfitSuggestion[] {
  if (limit <= 0) return [];
  const source = items.find((item) => item.id === sourceId);
  if (!source) return [];

  const byCategory = new Map<WardrobeCategory, WardrobeItem[]>();
  for (const candidate of items) {
    if (candidate.id === source.id) continue;
    const compatibility = wardrobeCompatibility(source, candidate, relations);
    if (compatibility.category <= 0 || compatibility.total < 0.25) continue;
    const group = byCategory.get(candidate.category) ?? [];
    group.push(candidate);
    byCategory.set(candidate.category, group);
  }

  for (const group of byCategory.values()) {
    group.sort((left, right) => {
      const score = wardrobeCompatibility(source, right, relations).total - wardrobeCompatibility(source, left, relations).total;
      return score || compareStable(left.name, right.name) || compareStable(left.id, right.id);
    });
    group.splice(3);
  }

  const suggestions = new Map<string, OutfitSuggestion>();
  for (const template of templatesFor(source.category)) {
    const combinations = cartesian(template.map((category) => byCategory.get(category) ?? []));
    for (const combination of combinations) {
      const outfitItems = [source, ...combination];
      const ids = outfitItems.map((item) => item.id).sort(compareStable);
      const id = `outfit:${ids.map(encodeURIComponent).join('|')}`;
      const evaluated = outfitScore(outfitItems, relations);
      if (evaluated.score < 0.3) continue;
      suggestions.set(id, {
        id,
        items: outfitItems,
        score: evaluated.score,
        reasons: evaluated.reasons,
      });
    }
  }

  return [...suggestions.values()]
    .sort((left, right) => right.score - left.score || compareStable(left.id, right.id))
    .slice(0, limit);
}
