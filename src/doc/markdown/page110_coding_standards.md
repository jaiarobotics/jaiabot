# Jaia Coding Standards

## Function Comments (TypeScript)
```
/**
 * Describe what the function does
 *
 * @param {string} thing - here we quickly explain why we need this parameter
 * @returns {void} - here we briefly describe what is being returned
*/
function doSomething(thing: string) {
  console.log(`Doing ${thing}!`)
}
```

#### Explanation of the comments:

* **Description**: Provides a brief overview of what the function is designed to do

* **Parameters**: Justifies why the parameters are needed

* **Return Value**: Specifies the output of the function

*This type of comment helps future developers understand the purpose of the function and what to expect when using it.*
