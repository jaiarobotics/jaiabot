// Jest mock for clipper2-ts. Implements just enough for the router's expandPolygon
// to return a usable (slightly enlarged) polygon without the real Clipper2 library.

type Point = { x: number; y: number };
type Path = Point[];
type Paths = Path[];

function centroid(path: Path): Point {
    const x = path.reduce((s, p) => s + p.x, 0) / path.length;
    const y = path.reduce((s, p) => s + p.y, 0) / path.length;
    return { x, y };
}

function scaleOutward(path: Path, margin: number): Path {
    const c = centroid(path);
    return path.map((p) => {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: p.x + (dx / len) * margin, y: p.y + (dy / len) * margin };
    });
}

export const FillRule = { NonZero: 0, EvenOdd: 1 };
export const JoinType = { Round: 0, Miter: 1, Square: 2 };
export const EndType = { Polygon: 0, Joined: 1, Butt: 2, Square: 3, Round: 4 };

export const Clipper = {
    union(subject: Paths, _clip: Paths, _fillRule: number): Paths {
        return subject;
    },
    inflatePaths(paths: Paths, margin: number, _joinType: number, _endType: number): Paths {
        return paths.map((path) => scaleOutward(path, margin));
    },
    ramerDouglasPeuckerPaths(paths: Paths, _epsilon: number): Paths {
        return paths;
    },
};
