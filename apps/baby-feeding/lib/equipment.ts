export const EQUIPMENT_STORAGE_KEY = '@expo-template/baby-feeding/equipment-v1';

export type EquipmentKind = 'bottle' | 'pump-kit';
export type EquipmentStatus = 'dirty' | 'washed' | 'sterilized';

export type EquipmentItem = {
  id: string;
  kind: EquipmentKind;
  status: EquipmentStatus;
  updatedAt: number;
};

export type EquipmentState = {
  items: EquipmentItem[];
};

export function emptyEquipmentState(): EquipmentState {
  return { items: [] };
}

function isEquipmentKind(value: unknown): value is EquipmentKind {
  return value === 'bottle' || value === 'pump-kit';
}

function isEquipmentStatus(value: unknown): value is EquipmentStatus {
  return value === 'dirty' || value === 'washed' || value === 'sterilized';
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function equipmentItems(state: EquipmentState, kind: EquipmentKind): EquipmentItem[] {
  return state.items
    .filter((item) => item.kind === kind)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function addEquipmentItem(
  state: EquipmentState,
  item: Omit<EquipmentItem, 'status'> & { status?: EquipmentStatus },
): EquipmentState {
  if (
    !item.id ||
    !isEquipmentKind(item.kind) ||
    !isTimestamp(item.updatedAt) ||
    (item.status !== undefined && !isEquipmentStatus(item.status)) ||
    state.items.some((candidate) => candidate.id === item.id)
  ) {
    return state;
  }

  return {
    items: [
      ...state.items,
      { ...item, status: item.status ?? 'sterilized' },
    ],
  };
}

export function setEquipmentStatus(
  state: EquipmentState,
  id: string,
  status: EquipmentStatus,
  updatedAt: number,
): EquipmentState {
  if (!id || !isEquipmentStatus(status) || !isTimestamp(updatedAt)) return state;
  let changed = false;
  const items = state.items.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return { ...item, status, updatedAt };
  });
  return changed ? { items } : state;
}

export function markEquipmentUsed(
  state: EquipmentState,
  kind: EquipmentKind,
  fallbackId: string,
  updatedAt: number,
): EquipmentState {
  if (!isEquipmentKind(kind) || !fallbackId || !isTimestamp(updatedAt)) return state;

  const available = state.items.find(
    (item) => item.kind === kind && (item.status === 'sterilized' || item.status === 'washed'),
  );
  if (available) return setEquipmentStatus(state, available.id, 'dirty', updatedAt);

  return addEquipmentItem(state, {
    id: fallbackId,
    kind,
    status: 'dirty',
    updatedAt,
  });
}

export function deserializeEquipmentState(value: string | null): EquipmentState {
  if (!value) return emptyEquipmentState();

  try {
    const parsed = JSON.parse(value) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return emptyEquipmentState();

    const seen = new Set<string>();
    const items = parsed.items.flatMap<EquipmentItem>((candidate) => {
      if (!candidate || typeof candidate !== 'object') return [];
      const item = candidate as Record<string, unknown>;
      if (
        typeof item.id !== 'string' ||
        !item.id ||
        seen.has(item.id) ||
        !isEquipmentKind(item.kind) ||
        !isEquipmentStatus(item.status) ||
        !isTimestamp(item.updatedAt)
      ) {
        return [];
      }
      seen.add(item.id);
      return [{
        id: item.id,
        kind: item.kind,
        status: item.status,
        updatedAt: item.updatedAt,
      }];
    });

    return { items };
  } catch {
    return emptyEquipmentState();
  }
}
