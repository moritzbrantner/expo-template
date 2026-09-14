export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  purchased: boolean;
  createdAt: string;
};

export function createShoppingItem(
  name: string,
  id: string,
  quantity = '',
  now = new Date(),
): ShoppingItem {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Item name is required.');

  return {
    id,
    name: trimmedName,
    quantity: quantity.trim(),
    purchased: false,
    createdAt: now.toISOString(),
  };
}

export function toggleShoppingItem(item: ShoppingItem): ShoppingItem {
  return { ...item, purchased: !item.purchased };
}

export function clearPurchased(items: readonly ShoppingItem[]): ShoppingItem[] {
  return items.filter((item) => !item.purchased);
}

export function orderShoppingItems(items: readonly ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((left, right) => Number(left.purchased) - Number(right.purchased));
}

export function deserializeShoppingItems(value: string | null): ShoppingItem[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((candidate): candidate is ShoppingItem => {
      if (!candidate || typeof candidate !== 'object') return false;
      const item = candidate as Partial<ShoppingItem>;
      return (
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.quantity === 'string' &&
        typeof item.purchased === 'boolean' &&
        typeof item.createdAt === 'string'
      );
    });
  } catch {
    return [];
  }
}
