import { wardrobeSimilarity, type WardrobeSimilarity } from './semantic';
import { normalizeWardrobeText, type WardrobeItem } from './wardrobe';

export type WardrobeCluster = {
  id: string;
  representative: WardrobeItem;
  items: WardrobeItem[];
  meanSimilarity: number;
};

export type WardrobeOutlier = {
  item: WardrobeItem;
  strongestSimilarity: number;
};

export type WardrobeRedundancyGroup = {
  id: string;
  representative: WardrobeItem;
  items: WardrobeItem[];
  meanSimilarity: number;
};

export type WardrobeExploration = {
  clusters: WardrobeCluster[];
  outliers: WardrobeOutlier[];
  redundancyGroups: WardrobeRedundancyGroup[];
};

export type WardrobeExplorationOptions = {
  clusterThreshold?: number;
  outlierThreshold?: number;
  redundancyThreshold?: number;
  redundancyMinEvidence?: number;
};

const DEFAULT_OPTIONS: Required<WardrobeExplorationOptions> = {
  clusterThreshold: 0.62,
  outlierThreshold: 0.32,
  redundancyThreshold: 0.8,
  redundancyMinEvidence: 5,
};

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

function compareItems(left: WardrobeItem, right: WardrobeItem) {
  return compareStableText(left.name, right.name) || compareStableText(left.id, right.id);
}

function validateThreshold(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a finite value between 0 and 1.`);
  }
}

function validateOptions(options: Required<WardrobeExplorationOptions>) {
  validateThreshold(options.clusterThreshold, 'clusterThreshold');
  validateThreshold(options.outlierThreshold, 'outlierThreshold');
  validateThreshold(options.redundancyThreshold, 'redundancyThreshold');
  if (!Number.isInteger(options.redundancyMinEvidence) || options.redundancyMinEvidence < 1) {
    throw new Error('redundancyMinEvidence must be a positive integer.');
  }
}

type Pairwise = {
  items: WardrobeItem[];
  similarities: (WardrobeSimilarity | null)[][];
};

function buildPairwise(items: readonly WardrobeItem[]): Pairwise {
  const ordered = [...items].sort(compareItems);
  const similarities = Array.from({ length: ordered.length }, () =>
    Array<WardrobeSimilarity | null>(ordered.length).fill(null),
  );

  for (let left = 0; left < ordered.length; left += 1) {
    for (let right = left + 1; right < ordered.length; right += 1) {
      const similarity = wardrobeSimilarity(ordered[left], ordered[right]);
      similarities[left][right] = similarity;
      similarities[right][left] = similarity;
    }
  }

  return { items: ordered, similarities };
}

function similarityAt(pairwise: Pairwise, left: number, right: number) {
  if (left === right) {
    return 1;
  }
  return pairwise.similarities[left][right]?.total ?? 0;
}

function connectedComponents(
  pairwise: Pairwise,
  predicate: (similarity: WardrobeSimilarity) => boolean,
) {
  const visited = new Set<number>();
  const components: number[][] = [];

  for (let start = 0; start < pairwise.items.length; start += 1) {
    if (visited.has(start)) {
      continue;
    }

    const component: number[] = [];
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) {
        break;
      }
      component.push(current);

      for (let candidate = 0; candidate < pairwise.items.length; candidate += 1) {
        if (candidate === current || visited.has(candidate)) {
          continue;
        }
        const similarity = pairwise.similarities[current][candidate];
        if (similarity && predicate(similarity)) {
          visited.add(candidate);
          queue.push(candidate);
        }
      }
    }

    components.push(component.sort((left, right) => compareItems(pairwise.items[left], pairwise.items[right])));
  }

  return components;
}

function representativeIndex(pairwise: Pairwise, indexes: readonly number[]) {
  if (indexes.length === 0) {
    throw new Error('Cannot choose a representative for an empty group.');
  }

  return [...indexes].sort((left, right) => {
    const leftMean = meanSimilarityForMember(pairwise, indexes, left);
    const rightMean = meanSimilarityForMember(pairwise, indexes, right);
    if (rightMean !== leftMean) {
      return rightMean - leftMean;
    }
    return compareItems(pairwise.items[left], pairwise.items[right]);
  })[0];
}

function meanSimilarityForMember(pairwise: Pairwise, indexes: readonly number[], source: number) {
  if (indexes.length <= 1) {
    return 0;
  }
  let total = 0;
  let count = 0;
  for (const candidate of indexes) {
    if (candidate === source) {
      continue;
    }
    total += similarityAt(pairwise, source, candidate);
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

function meanWithinGroup(pairwise: Pairwise, indexes: readonly number[]) {
  if (indexes.length <= 1) {
    return 0;
  }
  let total = 0;
  let count = 0;
  for (let left = 0; left < indexes.length; left += 1) {
    for (let right = left + 1; right < indexes.length; right += 1) {
      total += similarityAt(pairwise, indexes[left], indexes[right]);
      count += 1;
    }
  }
  return count === 0 ? 0 : total / count;
}

function groupId(prefix: string, items: readonly WardrobeItem[]) {
  return `${prefix}:${items.map((item) => item.id).sort().join('|')}`;
}

function availableEvidenceCount(similarity: WardrobeSimilarity) {
  return Object.values(similarity.available).filter(Boolean).length;
}

function hasRichMatchingEvidence(similarity: WardrobeSimilarity) {
  return (
    (similarity.available.materials && similarity.materials > 0) ||
    (similarity.available.seasons && similarity.seasons > 0) ||
    (similarity.available.occasions && similarity.occasions > 0) ||
    (similarity.available.formality && similarity.formality > 0.5) ||
    (similarity.available.fit && similarity.fit > 0.5) ||
    (similarity.available.tags && similarity.tags > 0)
  );
}

export function exploreWardrobe(
  items: readonly WardrobeItem[],
  options: WardrobeExplorationOptions = {},
): WardrobeExploration {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  validateOptions(resolved);

  const pairwise = buildPairwise(items);

  const clusters = connectedComponents(
    pairwise,
    (similarity) => similarity.total >= resolved.clusterThreshold,
  )
    .filter((indexes) => indexes.length >= 2)
    .map((indexes) => {
      const groupItems = indexes.map((index) => pairwise.items[index]);
      return {
        id: groupId('cluster', groupItems),
        representative: pairwise.items[representativeIndex(pairwise, indexes)],
        items: groupItems,
        meanSimilarity: meanWithinGroup(pairwise, indexes),
      };
    })
    .sort((left, right) =>
      right.items.length - left.items.length || compareItems(left.representative, right.representative),
    );

  const outliers = pairwise.items
    .map((item, index) => {
      let strongestSimilarity = 0;
      for (let candidate = 0; candidate < pairwise.items.length; candidate += 1) {
        if (candidate !== index) {
          strongestSimilarity = Math.max(strongestSimilarity, similarityAt(pairwise, index, candidate));
        }
      }
      return { item, strongestSimilarity };
    })
    .filter((candidate) => candidate.strongestSimilarity < resolved.outlierThreshold)
    .sort(
      (left, right) =>
        left.strongestSimilarity - right.strongestSimilarity || compareItems(left.item, right.item),
    );

  const redundancyGroups = connectedComponents(pairwise, (similarity) => {
    return (
      similarity.total >= resolved.redundancyThreshold &&
      availableEvidenceCount(similarity) >= resolved.redundancyMinEvidence &&
      hasRichMatchingEvidence(similarity)
    );
  })
    .filter((indexes) => indexes.length >= 2)
    .map((indexes) => {
      const groupItems = indexes.map((index) => pairwise.items[index]);
      return {
        id: groupId('redundancy', groupItems),
        representative: pairwise.items[representativeIndex(pairwise, indexes)],
        items: groupItems,
        meanSimilarity: meanWithinGroup(pairwise, indexes),
      };
    })
    .sort((left, right) =>
      right.meanSimilarity - left.meanSimilarity || compareItems(left.representative, right.representative),
    );

  return { clusters, outliers, redundancyGroups };
}
