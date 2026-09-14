// Allows ES6 imports of SVG, PNG, and LESS files to work in TypeScript
declare module "*.less" {
    const content: Record<string, string>;
    export default content;
}
declare module "*.svg" {
    const content: string;
    export default content;
}
declare module "*.png" {
    const content: string;
    export default content;
}
