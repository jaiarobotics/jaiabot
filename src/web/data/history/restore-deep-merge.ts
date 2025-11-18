import cloneDeep from "lodash/cloneDeep";

/**
 *
 * @param {any} obj item to check
 * @returns {boolean} returns true if the value is a plain object (not null, not an array, not a Map)
 */
function isObject(obj: any): obj is object {
    return obj !== null && typeof obj === "object" && !Array.isArray(obj) && !(obj instanceof Map);
}

/**
 * Deeply merges a snapshot into a target object for full state restore.
 * - Keeps outer object references intact.
 * - Updates Maps in-place, clearing them first so they exactly match the snapshot.
 * - Updates arrays in-place to preserve references.
 * - Recursively merges nested objects.
 *
 * @param {any} target object to merge data into
 * @param {any} snapshot object to pull data from
 *
 * @returns {void}
 */
export function restoreDeepMerge(target: any, snapshot: any) {
    if (!snapshot || !target) return;

    for (const key in snapshot) {
        const sourceValue = snapshot[key];
        const targetValue = target[key];

        if (sourceValue && typeof sourceValue === "object") {
            if (sourceValue instanceof Map && targetValue instanceof Map) {
                // Clear Map first to remove extra entries, then populate
                targetValue.clear();
                sourceValue.forEach((v, k) => {
                    if (isObject(v)) {
                        targetValue.set(k, cloneDeep(v));
                    } else {
                        targetValue.set(k, v);
                    }
                });
            } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
                // Update arrays in-place to preserve references
                targetValue.length = 0;
                targetValue.push(...sourceValue);
            } else if (isObject(sourceValue) && isObject(targetValue)) {
                // Plain object: merge recursively
                restoreDeepMerge(targetValue, sourceValue);
            } else {
                // Replace primitives or mismatched types
                target[key] = cloneDeep(sourceValue);
            }
        } else {
            // Primitive: overwrite
            target[key] = sourceValue;
        }
    }
}
