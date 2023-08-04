class BisectResult<T> {
    index: number
    value: T
}


// Performs a binary search on a sorted array, using a function f to determine ordering
export function bisect<T>(sorted_array: T[], f: (t: T) => number): BisectResult<T> | null {
    let start = 0, end = sorted_array.length - 1
    
    // target is before the beginning of the array, so return null
    if (f(sorted_array[start]) < 0) {
        return null
    }

    // Iterate while start not meets end
    while (start <= end) {
        if (end - start <= 1)
            return {
                index: start, 
                value: sorted_array[start]
            }

            // Find the mid index
            let mid = Math.floor((start + end) / 2)

            // Find which half we're in
            if (f(sorted_array[mid]) < 0) {
                end = mid
            }
        else {
            start = mid
        }
    }

    return null
}

