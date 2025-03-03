// Allows ES6 imports of SVG files to work in TypeScript
declare module "*.svg" {
    const content: string;
    export default content;
}
