export function colorNameToHex(colorName: string): string | undefined
{
    var colors: {[key: string]: string} = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
    "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
    "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
    "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
    "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
    "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
    "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
    "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
    "honeydew":"#f0fff0","hotpink":"#ff69b4",
    "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
    "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
    "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
    "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
    "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
    "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
    "navajowhite":"#ffdead","navy":"#000080",
    "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
    "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
    "rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
    "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
    "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
    "violet":"#ee82ee",
    "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
    "yellow":"#ffff00","yellowgreen":"#9acd32"}

    return colors[colorName.toLowerCase()]
}


export class Color {
    r = 0
    g = 0
    b = 0
    a = 0

    constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 1) {
        this.r = r
        this.g = g
        this.b = b
        this.a = a
    }

    static fromHexShort(hexRGB: string) {
        const r = hexRGB.slice(1, 2)
        const g = hexRGB.slice(2, 3)
        const b = hexRGB.slice(3, 4)

        const a = hexRGB.length == 5 ? hexRGB.slice(4, 5) : 'f'

        return new Color(
            parseInt(r + r, 16), 
            parseInt(g + g, 16), 
            parseInt(b + b, 16), 
            parseInt(a + a, 16)
        )
    }

    static fromHexLong(hexRGB: string) {
        const r = hexRGB.slice(1, 3)
        const g = hexRGB.slice(3, 5)
        const b = hexRGB.slice(5, 7)

        const a = hexRGB.length == 9 ? hexRGB.slice(7, 9) : 'ff'

        return new Color(
            parseInt(r, 16), 
            parseInt(g, 16), 
            parseInt(b, 16), 
            parseInt(a, 16)
        )
    }

    static fromHex(hexString: string) {
        if (hexString.length == 4 || hexString.length == 5) {
            return this.fromHexShort(hexString)
        }

        if (hexString.length == 7 || hexString.length == 9) {
            return this.fromHexLong(hexString)
        }

        console.error('Cannot process hex string: ' + hexString)
        return new Color()
    }

    static fromRGBA(r: string, g: string, b: string, a: string) {
        function toByteValue(s: string) {
            s = s.trim()
            if (s.endsWith('%')) {
                return Math.round(parseFloat(s.slice(0, s.length - 1)) * 255 / 100)
            }
            else {
                return parseInt(s, 10)
            }
        }

        return new Color(toByteValue(r), toByteValue(g), toByteValue(b), toByteValue(a))
    }

    
    /**
     * Returns a Color object from an input CSS string
     * @date 11/3/2023 - 2:10:51 PM
     *
     * @static
     * @param {string} cssString CSS string (supports color names, #RGBA, rgb() and rgba())
     * @returns {Color} an instance of the Color class representing the same color as the cssString
     */
    static fromCSSString(cssString: string) {
        // Hex RGB(A)        
        if (cssString[0] == '#') {
            return this.fromHex(cssString)
        }

        // named color
        const hexString = colorNameToHex(cssString)
        if (hexString != null) {
            return this.fromHex(hexString)
        }

        // rgb
        const rgbMatch = cssString.match(/rgb\((.+),(.+),(.+)\)/)
        if (rgbMatch) {
            return this.fromRGBA(rgbMatch[1], rgbMatch[2], rgbMatch[3], '255')
        }

        // rgba
        const rgbaMatch = cssString.match(/rgba\((.+),(.+),(.+),(.+)\)/)
        if (rgbaMatch) {
            return this.fromRGBA(rgbaMatch[1], rgbaMatch[2], rgbaMatch[3], rgbaMatch[4])
        }
        
        console.error(`Cannot convert CSS color string: ${cssString}`)
        return new Color()
    }

    withAlpha(a: number) {
        return new Color(this.r, this.g, this.b, a)
    }

    toHex() {
        function fix(value: number) {
            return value.toString(16).padStart(2, '0')
        }

        return `#${fix(this.r)}${fix(this.g)}${fix(this.b)}${fix(this.a)}`
    }

}
