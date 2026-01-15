/**
 * Descriptor for a data series
 *
 */
export interface SeriesDescriptor {
    /**
     * Human-readable name of the series
     * */
    name: string;

    /**
     * HDF path of the series
     */
    path: string;

    /**
     * Description of the series
     */
    description: string;

    /**
     * Units of the series
     */
    units: string;

    /**
     * Frequency the series is sampled at
     */
    frequency: number;
}

export function SeriesDescriptor_matchesString(
    seriesDescriptor: SeriesDescriptor,
    query: string,
): boolean {
    const lowerQuery = query.toLowerCase();
    return (
        seriesDescriptor.name.toLowerCase().includes(lowerQuery) ||
        seriesDescriptor.path.toLowerCase().includes(lowerQuery) ||
        seriesDescriptor.description?.toLowerCase()?.includes(lowerQuery)
    );
}
