// Allows ES6 imports of SVG and PNG files to work in TypeScript
declare module "*.svg" {
    const content: string;
    export default content;
}
declare module "*.png" {
    const content: string;
    export default content;
}
