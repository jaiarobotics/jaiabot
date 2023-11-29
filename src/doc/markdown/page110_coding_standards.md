# Jaia Coding Standards

## Function Comments (TypeScript)
```
/**
 * Describe what the function does
 *
 * @param {string} name Briefly explain why we need this parameter
 * @returns {string} Briefly describe what is being returned
 */
function createGreeting(name: string) {
  return `Hello ${name},` 
}
```

### Explanation of the comments:

* **Description**: Provides a brief overview of what the function is designed to do

* **Parameters**: Justifies why the parameters are needed

* **Return Value**: Specifies the output of the function

*This type of comment helps future developers understand the purpose of the function and what to expect when using it.*

### More Examples
```
/**
 * Determines which runs in a mission are eligible to start and plays those runs
 * 
 * @param {MissionInterface} mission Holds the runs 
 * @param {CommandList} addRuns A set of runs to be added to the mission
 * @returns {void}
 */
runMission(mission: MissionInterface, addRuns: CommandList) {
  // Run mission
}
```

```
/**
 * Reset mission planning
 * 
 * @param {MissionInterface} mission Used to access the mission state
 * @param {boolean} needConfirmation Does the deletion require a confirmation by the opertor?
 * @returns {Promise<boolean>} Did the deletion occur?
 */
async deleteAllRunsInMission(mission: MissionInterface, needConfirmation: boolean) {
  // Delete all runs
}
```
