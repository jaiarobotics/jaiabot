import './CSSStyles.less'

/**
 * This function gets the styles for the className in the current document.
 * @date 11/3/2023 - 11:21:59 AM
 *
 * @param {string} className
 * @returns {CSSStyleDeclaration} The styles for class className.
 */
function getCSSStyleForClass(className: string) {
    const dummyElement = document.createElement('div')
    dummyElement.className = className
    document.body.appendChild(dummyElement)
    const computedStyle = JSON.parse(JSON.stringify(getComputedStyle(dummyElement))) as CSSStyleDeclaration
    document.body.removeChild(dummyElement)

    return computedStyle
}

export const defaultBot = getCSSStyleForClass('default bot-icon')
export const selectedBot = getCSSStyleForClass('selected bot-icon')
export const inactiveBot = getCSSStyleForClass('inactive bot-icon')
export const controlledBot = getCSSStyleForClass('controlled bot-icon')
export const trackedBot = getCSSStyleForClass('tracked bot-icon')
export const disconnectedBot = getCSSStyleForClass('disconnected bot-icon')
export const goodBot = getCSSStyleForClass('good bot-icon')
export const warningBot = getCSSStyleForClass('warning bot-icon')
export const errorBot = getCSSStyleForClass('error bot-icon')
export const rcBot = getCSSStyleForClass('rc bot-icon')
export const activeGoal = getCSSStyleForClass('active-goal')
export const editMission = getCSSStyleForClass('edit-mission')
export const gpsIcon = getCSSStyleForClass('gps-icon')
export const commsInnerCircle = getCSSStyleForClass('comms-inner-circle')
export const commsOuterCircle = getCSSStyleForClass('comms-outer-circle')
