import { SeriesDescriptor } from "./SeriesDescriptor";

interface PathIndexEntry {
    keyword: string;
    descriptors: SeriesDescriptor[];
}

export class PathIndex {
    title_keyword_index: PathIndexEntry[] = [];
    path_keyword_index: PathIndexEntry[] = [];
    description_keyword_index: PathIndexEntry[] = [];
    delimiter: RegExp = /[\s/_]+/;

    constructor(seriesDescriptors: SeriesDescriptor[], delimiter: RegExp = /[\s/_]+/) {
        console.log("** PathIndex Constructor called with seriesDescriptors **");
        console.log(seriesDescriptors);
        this.delimiter = delimiter;

        let title_keyword_map = new Map<string, SeriesDescriptor[]>();
        let path_keyword_map = new Map<string, SeriesDescriptor[]>();
        let description_keyword_map = new Map<string, SeriesDescriptor[]>();

        for (const descriptor of seriesDescriptors) {
            const titleKeywords = descriptor.name?.toLowerCase()?.split(this.delimiter) ?? [];
            const pathKeywords = descriptor.path?.toLowerCase()?.split(this.delimiter) ?? [];
            const descriptionKeywords =
                descriptor.description?.toLowerCase()?.split(this.delimiter) ?? [];
            for (const keyword of titleKeywords) {
                if (!title_keyword_map.has(keyword)) {
                    title_keyword_map.set(keyword, []);
                }
                title_keyword_map.get(keyword)!.push(descriptor);
            }

            for (const keyword of pathKeywords) {
                if (!path_keyword_map.has(keyword)) {
                    path_keyword_map.set(keyword, []);
                }
                path_keyword_map.get(keyword)!.push(descriptor);
            }

            for (const keyword of descriptionKeywords) {
                if (!description_keyword_map.has(keyword)) {
                    description_keyword_map.set(keyword, []);
                }
                description_keyword_map.get(keyword)!.push(descriptor);
            }
        }

        this.title_keyword_index = Array.from(title_keyword_map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([keyword, descriptors]) => ({
                keyword,
                descriptors,
            }));
        this.description_keyword_index = Array.from(description_keyword_map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([keyword, descriptors]) => ({
                keyword,
                descriptors,
            }));
        this.path_keyword_index = Array.from(path_keyword_map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([keyword, descriptors]) => ({
                keyword,
                descriptors,
            }));

        console.debug("PathIndex initialized with", seriesDescriptors.length, "descriptors");
        console.debug("Title index:", Object.keys(this.title_keyword_index).length, "keywords");
        console.debug("Path index:", Object.keys(this.path_keyword_index).length, "keywords");
        console.debug(
            "Description index:",
            Object.keys(this.description_keyword_index).length,
            "keywords",
        );
    }

    search(query: string): SeriesDescriptor[] {
        interface SearchResult {
            descriptor: SeriesDescriptor;
            score: number;
        }
        let scoreMap: Map<string, SearchResult> = new Map();

        const keywords = query.toLowerCase().split(this.delimiter);

        console.log("* searching with this query *");
        console.log(query);

        for (const keyword of keywords) {
            for (const entry of this.title_keyword_index) {
                if (entry.keyword.startsWith(keyword)) {
                    for (const descriptor of entry.descriptors) {
                        if (!scoreMap.has(descriptor.path)) {
                            scoreMap.set(descriptor.path, { descriptor, score: 0 });
                        }
                        scoreMap.get(descriptor.path)!.score += 3;
                    }
                }
            }

            for (const entry of this.description_keyword_index) {
                if (entry.keyword.startsWith(keyword)) {
                    for (const descriptor of entry.descriptors) {
                        if (!scoreMap.has(descriptor.path)) {
                            scoreMap.set(descriptor.path, { descriptor, score: 0 });
                        }
                        scoreMap.get(descriptor.path)!.score += 2;
                    }
                }
            }

            for (const entry of this.path_keyword_index) {
                if (entry.keyword.startsWith(keyword)) {
                    for (const descriptor of entry.descriptors) {
                        if (!scoreMap.has(descriptor.path)) {
                            scoreMap.set(descriptor.path, { descriptor, score: 0 });
                        }
                        scoreMap.get(descriptor.path)!.score += 1;
                    }
                }
            }
        }

        const results = Array.from(scoreMap.values());
        results.sort((a, b) => b.score - a.score); // Sort by score descending
        return results.map((result) => result.descriptor);
    }
}
