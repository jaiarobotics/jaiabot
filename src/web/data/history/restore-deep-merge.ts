import cloneDeep from "lodash/cloneDeep";

/**
 * Helper function to identify plain objects
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

    // process each key in the snapshot individually
    for (const key in snapshot) {
        const sourceValue = snapshot[key];
        const targetValue = target[key];

        // Object types have to be handled correctly
        if (sourceValue && typeof sourceValue === "object") {
            // Maps are reconstructed in place to preserve references to the Map
            if (sourceValue instanceof Map && targetValue instanceof Map) {
                // Clear Map first to remove extra entries, then populate
                targetValue.clear();
                sourceValue.forEach((v, k) => {
                    // If the value is an object, clone it
                    if (isObject(v)) {
                        targetValue.set(k, cloneDeep(v));
                    } else {
                        targetValue.set(k, v);
                    }
                });

                // Arrays are updated in place to preserve references
            } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
                targetValue.length = 0;
                targetValue.push(...sourceValue);

                // Plain objects are merged recursively
            } else if (isObject(sourceValue) && isObject(targetValue)) {
                restoreDeepMerge(targetValue, sourceValue);

                // Catch all for unexpected object types
            } else {
                console.warn(
                    `restoreDeepMerge: unexpected type mismatch or unsupported object type for key "${key}"`,
                );
                // Clone unexpected objects
                target[key] = cloneDeep(sourceValue);
            }

            // Primitive values are just overwritten
        } else {
            target[key] = sourceValue;
        }
    }
}
