// src/app/utils/track-by.utils.ts

/**
 * Track by item.id (generic) — fallback to index
 */
export function trackById<T extends { id?: any }>(index: number, item: T): any {
  return item?.id ?? index;
}

/**
 * Track by item.activityId — fallback to index
 */
export function trackByActivityId<T extends { activityId?: any }>(index: number, item: T): any {
  return item?.activityId ?? index;
}

/**
 * Track by index — dùng khi không có id rõ ràng
 */
export function trackByIndex(index: number): number {
  return index;
}
