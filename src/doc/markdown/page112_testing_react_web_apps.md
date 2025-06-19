# Testing React Web Apps

- [Testing React Web Apps](#testing-react-web-apps)
  - [Introduction](#introduction)
  - [Resources](#resources)
  - [Basic Testing Strategies](#basic-testing-strategies)
    - [Unit Testing](#unit-testing)
    - [Integration Testing](#integration-testing)
    - [Functional Testing](#functional-testing)
  - [Test File Stucture](#test-file-stucture)
  - [Running the Test](#running-the-test)
    - [Debugging a Test](#debugging-a-test)
  - [Anatomy of a React Test](#anatomy-of-a-react-test)
    - [Setting up the Test](#setting-up-the-test)
      - [Props](#props)
      - [Mocks](#mocks)
      - [Declaring the Test](#declaring-the-test)
    - [Rendering the Component](#rendering-the-component)
      - [Re-Rendering](#re-rendering)
    - [Accessing React Elements](#accessing-react-elements)
    - [Triggering Elements](#triggering-elements)
      - [Asynchronous Behavior](#asynchronous-behavior)
    - [Verifying Element Behavior](#verifying-element-behavior)
    - [Verifying Component Outputs](#verifying-component-outputs)
      - [Using jest.fn()](#using-jestfn)
      - [Checking Values of Modified Props](#checking-values-of-modified-props)
  - [More on Mocking](#more-on-mocking)
    - [Mocking a Class](#mocking-a-class)
    - [Mocking Partials](#mocking-partials)
  - [Test Setup, Teardown and Scoping](#test-setup-teardown-and-scoping)
  - [Parameterized Tests](#parameterized-tests)
  - [Test Configuration](#test-configuration)
    - [src/web/jest.config.js](#srcwebjestconfigjs)
    - [src/web/tests/jest.setup.js](#srcwebtestsjestsetupjs)
    - [src/web/tsconfig.json](#srcwebtsconfigjson)

## Introduction

Jaia Command and Control (JCC) and Jaia Data Vision (JDV) are React Applications written in Typescript and Javascript. To test these applications we are using Jest as the foundation testing framework with React Testing Library providing ways to interact with React Components. These tools can be used to create unit tests, integration tests, and functional tests.

This document is meant to serve as a starting point for people new to Jest and React Testing Library (RTL). We are still learning the ins and outs of using these tools so our approach and techniques will evolve as we learn. Please update this page with additional information if you learn a new way to do things or exercise more aspects of our applications.

## Resources

[Jest Documentation](https://jestjs.io/docs/getting-started)

[React Testing Library Documentation](https://testing-library.com/docs/)

## Basic Testing Strategies

Using RTL we want to ensure that our user interfaces work as intended under all circumstances.

### Unit Testing

Unit testing focuses on a specific software entitiy in isolation and exercises it's functionality by varying inputs and verifying expected outputs. In general, the entitiy will be one of our container modules (`src/web/containers`), and the focus of the test may be specific to an individual element in that container. The inputs of any given test are comprised of the Props passed into the container and simulated user actions. The outputs of the test are comprised of updates to props via the use of callback functions and changes to the visual components of the container being tested. An important concept in unit testing is exercising "Edge Conditions". Edge Conditions are sets of inputs and actions that present unique situations likely to cause problems for software. Think "how many different ways does this container need to render?"

### Integration Testing

Integration testing is similar to unit testing but focuses on the interaction of multiple softeware entities. The test will exercise functiionality of one container and verfiy it's impact on an element of another container. Think "what happens in that container if I do this in this container?"

### Functional Testing

Functional testing focuses on exercising a particular function of the application. Functional tests typically exercise multiple containers and components to achieve a certain goal condition. Think "what are the steps involved in achieving this result?"

## Test File Stucture

Test files should be named the same as the item being tested with `.test` inserted before the file suffix.
Unit tests should be located with the item being tested in a special directory named `__tests__`.

For example:

```
CommandControl/
├── CommandControl.less
├── CommandControl.tsx
└── __tests__
    └── CommandControl.test.tsx
```

## Running the Test

The simplest way to run a test is to enter `npm test` from anywhere within the `src/web` directory tree. This will cause Jest to
run all the tests in the directory tree.  
Notice in the example below Jest ran all the tests under `src/web` even though we were down in the `TaskSettingsPanel` folder.

```
:~/jaiabot/src/web/containers/TaskSettingsPanel$ npm test

> test
> jest

 PASS  containers/RallyPointPanel/__tests__/RallyPointPanel.test.tsx (12.796 s)
  RallyPointPanel: Button Interaction Tests
    ✓ Test Go To Button using test-id (122 ms)
    ✓ Test Go To Button using label (32 ms)
    ✓ Test Go To Button using title (39 ms)
    ✓ Test Delete Button using test-id (28 ms)
    ✓ Test Delete Button using label (25 ms)
    ✓ Test Delete Button using title (36 ms)

... (more tests)

Test Suites: 8 passed, 8 total
Tests:       62 passed, 62 total
Snapshots:   0 total
Time:        15.374 s, estimated 18 s
Ran all test suites.
```

If you want to run the test suites in a particular directory, you just need the name of the directory, you do not need the entire path.
In the example below, we are in the `src/web` directory and ran all the tests under `src/web/containers/TaskSettingsPanel`. It ran 3 test suites (files) from that directory.

```
:~/jaiabot/src/web$ npm test TaskSettingsPanel

> test
> jest TaskSettingsPanel

 PASS  containers/TaskSettingsPanel/__tests__/utils/ValidateTask.test.ts
  Placeholder to prevent Jest from failing due to no explicit test for a file inside __test__ dir
    ✓ Placeholder test (5 ms)
  ValidateTask Unit Tests

... (more individual tests)

 PASS  containers/TaskSettingsPanel/__tests__/utils/validate-task.ts
  Placeholder to prevent jest from failing due to no explicit test for a file inside __test__ dir
    ✓ Placeholder test

 PASS  containers/TaskSettingsPanel/__tests__/TaskSettingsPanel.test.tsx (7.199 s)
  Placeholder to prevent jest from failing due to no explicit test for a file inside __test__ dir
    ✓ Placeholder test (3 ms)
  TaskSettingsPanel: Should update task type correctly for all options
    ✓ Input Task: Valid No Task, Select all Options (265 ms)

 ... (more individual tests)

   Unit Test Bottom Dive Toggle JAIA-1512
    ✓ Toggle Bottom Dive, Verify Task (110 ms)

Test Suites: 3 passed, 3 total
Tests:       46 passed, 46 total
Snapshots:   0 total
Time:        8.08 s
Ran all test suites matching /TaskSettingsPanel/i.

```

If you want to run a single Test Suite you can provide the entire path to the file containing the Test Suite.

```
:~/jaiabot/src/web$ npm test containers/TaskSettingsPanel/__tests__/TaskSettingsPanel.test.tsx

> test
> jest containers/TaskSettingsPanel/__tests__/TaskSettingsPanel.test.tsx

 PASS  containers/TaskSettingsPanel/__tests__/TaskSettingsPanel.test.tsx (6.144 s)
  Placeholder to prevent jest from failing due to no explicit test for a file inside __test__ dir
    ✓ Placeholder test (1 ms)
  TaskSettingsPanel: Should update task type correctly for all options
    ✓ Input Task: Valid No Task, Select all Options (261 ms)
    ✓ Input Task: Valid Constant Heading, Select all Options (130 ms)
    ✓ Input Task: Valid Non-Bottom Dive, Select all Options (130 ms)
    ✓ Input Task: Valid Bottom Dive, Select all Options (123 ms)
    ✓ Input Task: Valid Surface Drift, Select all Options (120 ms)
    ✓ Input Task: Valid Station Keeping, Select all Options (118 ms)
    ✓ Input Task: Valid None Task Type, Select all Options (137 ms)
  Unit Test Bottom Dive Toggle JAIA-1512
    ✓ Toggle Bottom Dive, Verify Task (124 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        6.601 s, estimated 7 s
Ran all test suites matching /containers\/TaskSettingsPanel\/__tests__\/TaskSettingsPanel.test.tsx/i.
```

### Debugging a Test

You can debug your tests right in `VSCode`. Simply insert breakpoints where you need them and click on the `Debug` button or `Ctrl + Shift + D` to debug the current file.

## Anatomy of a React Test

Testing a React Component is broken down to a basic set of steps.

1. [Set Up Test](#setting-up-the-test)
2. [Render the Component Under Test](#rendering-the-component)
3. [Get Access to One or More React Element of the Component](#accessing-react-elements)
4. [Trigger Some Event(s) on the Element(s)](#triggering-elements)
5. [Verify the Behavior on the Element(s)](#verifying-element-behavior)
6. [Verify the Outputs of the Component](#verifying-component-outputs)

### Setting up the Test

For a Component test to function properly several things must be considered. We are trying to test a specific piece of the application in isolation, however it needs some context to operate properly.

#### Props

You will need to determine the minimum set of Prop parameters for the Component to function properly. This will depend on the specific functionality being tested. Props can be declared statically, created dynamically in the test, or read in from files. Typically, you will need to provide any data needed to put the Component in the correct state and callback functions to verify results and support the component behavior.

```
const mockProps: Props = {
    isEditMode: true,
    enableEcho: false,
    onChange: (task?: MissionTask) => mockOnChange(task),
};
```

#### Mocks

The word **mock** should be used when declaring items used to stand in for things outside of the unit(s) being tested. Mocks come in many flavors. You can mock variables, methods, and entire modules as needed (more on that later).

```
const defaultProps: Props = {
    isEditMode: true,
    enableEcho: false,
    onChange: (task?: MissionTask) => mockOnChange(task),
};

let mockProps: Props = defaultProps;

// Mock of the onChange callback to update Props
const mockOnChange = jest.fn().mockImplementation((task?: MissionTask) => {
    mockProps.task = task;
});
```

#### Declaring the Test

Tests are objects that include a test method that get run using the tools from **Jest** and **RTL**. The keyword `test` or `it` is used to declare a test object. The attributes of a test are a description followed by a test method and then an optional timeout value. Tests methods should be declared using Arrow Function syntax.

Example of complete simple test

```
test("JaiaAbout links to company website", () => {
    render(<JaiaAbout metadata={sampleMetadata1} />);
    const element = screen.getByText("www.jaia.tech");
    expect(element).toHaveAttribute("href", "https://www.jaia.tech");
});
```

### Rendering the Component

RTL uses the `jsdom` to simulate rendering of components just as the usual DOM would render them in a browser. The `jsdom` includes special hooks and methods to support testing.

```
render(<JaiaAbout metadata={sampleMetadata1} />);
```

#### Re-Rendering

Unlike the usual DOM, `jsdom` does not automatically re-render components based on changes to Props or Context. Most of our components are "controlled components", meaning their state is controlled by props and functionality is provided by callback functions. This means we need to explicitly re-render a component under test to cause changes to it. The `render` method of RTL returns a reference to the rendered object which includes a `rerender` method.

```
// Get the rerender method from the object returned when rendering the panel
const { rerender } = render(<TaskSettingsPanel {...mockProps} />);

// Rerender with updated props
rerender(<TaskSettingsPanel {...mockProps} />);
```

### Accessing React Elements

RTL provides many different ways to query the rendered component to get access to a specific element. See [About Queries](https://testing-library.com/docs/queries/about).

The object `screen` represents the rendered object being tested. The most common queries are listed below. In general, these use attributes of the element already existing in the code.

- getByRole
- getByText
- getByLabelText
- getByAltText
- getByTitle

In general, it is best to query using something visible to the user to make tests more consistent with how a user would use the application. In some cases, this can be difficult or impossible. In those cases, we can use a special attribute called `data-testid`. This is generally considered a last resort since this attribute has no corresponding use in the real application.

- getByTestId

Example Button:

```
<Button
    aria-label="Go To Rally Point Label"
    // testid to be used as last resort
    data-testid="go-to-rally-point-id"
    title="Go To Rally Point Button"
    className={"button-jcc"}
    onClick={() => props.goToRallyPoint(props.selectedRallyFeature)}
>
```

These methods all return a reference to the same Button object:

```
screen.getByTestId("go-to-rally-point-id");
screen.getByLabelText("Go To Rally Point Label");
screen.getByTitle("Go To Rally Point Button");
```

### Triggering Elements

Once you have access to an element, you will need to trigger it to make the component do something. There are two ways to trigger an element:

- [fireEvent method](https://testing-library.com/docs/dom-testing-library/api-events)
- [user-event library](https://testing-library.com/docs/user-event/intro)

In general, we always want to use the methods in the `user-event` companion library. `fireEvent` creates DOM events directly. `user-event` more closely emulates user interactions in a browser, which may trigger more than one DOM Event.

Triggering the Button element described above:

```
// Click the button
await userEvent.click(buttonElement);
```

#### Asynchronous Behavior

Many aspects of React applications run asynchronously so browsers do not lock up waiting for something to change. In general, anything that returns a promise is asyncrhonous. For this reason, we want to declare most of our tests as aynchronous methods.

```
test("JaiaToggle switching on/off", async () => {
    ...
});
```

And because things are asynchronous, we may have to wait for things to happen before continueing the test. See [Waiting for appearance](https://testing-library.com/docs/guide-disappearance).

This is why we have `await` in front of the call to `userEvent.click` above. This allows the test to wait until the promise is fulfilled before going further. In some cases we need to wrap the method with `waitfor` as well.

```
// Verify that the selected value is correct
await waitFor(() => {
        expect(selectElement.value).toBe(newValue);
});
```

This may take some trial and error to get right at first. Here are 2 discussions on the subject of asynchronous testing.

- [Do I need await before every userEvent call?](https://github.com/testing-library/user-event/discussions/1050)
- [Re-thinking approach to async event handling](https://github.com/testing-library/user-event/issues/504)

### Verifying Element Behavior

We often want to test that the visual elements of our components behave correctly. In general, we should always verify certain attributes of an element we expect to change from a trigger event. We may also want to verify elements are displayed correctly after rendering. Jest provides an `expect` method for making assertions. (Note: `assert` from `Node.js` can be used if needed but is not recommended)

Assert an element renders with the correct value:

```
const selectElement: HTMLSelectElement = screen.getByTestId("task-select-input-id");
expect(selectElement).toBeInTheDocument();
expect(selectElement.value).toBe(previousValue)
```

Assert an element changes after re-rendering:

```
// Rerender with updated props
rerender(<TaskSettingsPanel {...mockProps} />);

// Verify that the selected value is correct
await waitFor(() => {
    expect(selectElement.value).toBe(newValue);
});
```

Other examples:

```
expect(element).toHaveAttribute("href", "https://www.jaia.tech");
expect(panelElement).not.toBeVisible();
expect(toggle.disabled).toBe(true);
```

### Verifying Component Outputs

As stated above, most of our components are controlled, therefore, the outputs of them are passed as arguments to callback functions provided in the Props. In general, we create mock callback functions for our tests. These can be declared in the test object itself, outside the test object, or in a different file. It depends on the scope and reusability of the mock callback as to which location makes the most sense.

#### Using jest.fn()

Jest provides a convenient function for declaring mocks that can be overloaded as needed. The benefit of declaring your mocks as `jest.fn` is Jest provides a bunch of helper functions and attributes that can be used to verify how the callback has been used.

```
const mockGoToRallyPoint = jest.fn();
expect(mockGoToRallyPoint).toHaveBeenCalledTimes(1);
expect(mockGoToRallyPoint).toHaveBeenLastCalledWith(mockProps.selectedRallyFeature);
```

When declaring a mock using `jest.fn`, you can also provide some mock implementation.

Modifying Props in a mock callback example:

```
// Mock of the onChange callback to update Props
const mockOnChange = jest.fn().mockImplementation((task?: MissionTask) => {
    mockProps.task = task;
});
```

In some cases, you may want to create a wrapper container around the component that can maintain state:

```
function AccordionTestComponent(props: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

    function onChange() {
        setIsExpanded(!isExpanded);
        props.onChange();
    }

    return (
        <Accordion expanded={isExpanded} onChange={onChange}>
            <AccordionSummary>
                <Typography>Accordion Title Here</Typography>
            </AccordionSummary>
            <AccordionDetails>Accordion Details Here</AccordionDetails>
        </Accordion>
    );
}
```

#### Checking Values of Modified Props

Becasue most of our components are controlled by their parents, one way to verify data is to check the Props after they have been modified by the callback function. This would typicaly be done with a `rerender` call when you are also checking changes to the elements. You can do this directly in the test or in a separate 'helper' method.

Here we are checking an updated `task` Prop has been created correctly:

```
switch (task?.type) {
    case TaskType.CONSTANT_HEADING:
        // Make sure all the parameters are defined
        expect(task.constant_heading).toBeDefined();
        expect(task.constant_heading.constant_heading).toBeDefined();
        expect(task.constant_heading.constant_heading_speed).toBeDefined();
        expect(task.constant_heading.constant_heading_time).toBeDefined();
        // None of these should be present
        expect(task.dive).toBeUndefined();
        expect(task.station_keep).toBeUndefined();
        expect(task.surface_drift).toBeUndefined();
        break;
```

## More on Mocking

A very common use of mocks is to replace things that use a lot of resources or exercise external interfaces that are not needed for the test. This makes the tests run faster and avoids potential issues timing out waiting for external events.

We are still evolving in our use of mocks. Detailed informaiton is available here [Jest Mock Functions](https://jestjs.io/docs/mock-functions). Please update this section if you learn a new way of using mocks.

### Mocking a Class

`CommandControl.tsx` imports and uses `CustomLayerGroupFactory` to create map layers that require data downloaded from the Hub's server at run time. We do not need these for our tests and do not want our tests to depend on data being downloaded from an external source. We don't want to modify the source code being tested, so we create a mock to take the place of `CustomLayerGroupFactory`. General mocks like this should be placed in the `src/web/tests/__mocks__/` directory.

`src/web/tests/__mocks__/customLayers.mock.ts`

Here we create a mock of the CustomLayerGroupFactory class and the methods needed to support our test:

```
// Mock the CustomLayers, replace  createCustomLayerGroup
// Create a mock class for CustomLayerGroupFactory
const MockCustomLayerGroupFactory = jest.fn().mockImplementation(() => ({
    // Mock all methods or properties used by the module under test
    createCustomLayerGroup: jest.fn().mockResolvedValue(undefined), // Example method
    on: jest.fn(), // Mock event subscription
    off: jest.fn(), // Mock event unsubscription
}));

module.exports = {
    CustomLayerGroupFactory: MockCustomLayerGroupFactory,
};
```

Using the mock in `src/web/containers/CommandControl/__tests__/CommandControl.test.tsx`:

```
// Mock the CustomLayers, replace createCustomLayerGroup
jest.mock("../../../openlayers/map/layers/geotiffs/CustomLayers", () =>
    require("../../../tests/__mocks__/customLayers.mock.ts"),
);
```

### Mocking Partials

Sometimes we want to mock part of a module in our test to avoid costly operations that are not needed for the test but do not need or want to mock the entire module. In this case, we need only a partial mock of the module.

The `JaiaAPI` is a good example of this. The `JaiaAPI` class includes many methods used throughout our code. However, all external communication is handled by the `hit` method. Rather than mocking every method in the class and trying to figure out what implementation may be needed for each one we simply replace the `hit` method with a mock and use the rest of the real `JaiaAPI` class. We use the `jest.requireActual` function to achieve this.

`src/web/tests/__mocks__/jaiaAPI.mock.ts`

Here we tell Jest we want to use the real `JaiaAPI` class from `src/web/utils/jaia-api.ts` but replace its `hit` method with a mock that returns a mocked response.

```
// Mock JaiaAPI, replace the hit method on the jaiaAPI instance
// Import the real module to access the original jaiaAPI instance
const originalModule = jest.requireActual("../../utils/jaia-api");

originalModule.jaiaAPI.hit = jest
    .fn()
    .mockResolvedValue({ code: 200, msg: "Mocked Success", bots: [], hubs: [] });

module.exports = {
    ...originalModule, // Spread the real module
    jaiaAPI: originalModule.jaiaAPI, // Keep the original jaiaAPI instance with the mocked hit
};
```

## Test Setup, Teardown and Scoping

A file with Jest tests in it is considered a "Test Suite". A single `test` or `it` declares a "Test". Tests within a Test Suite can be further grouped by wrapping them with a `describe` block. It is important to keep the scope of these blocks in mind when declaring tests or items to support your tests.

Often when running multiple tests and groups of tests we need to run some code before and/or after each test or group to put the system in the correct state for each run. This is typically referred to as "Setup" and "Teardown" in testing. Mocks in particular often need to be reset as well as Props used in tests as part of a Setup. Teardown can be used to free up resources allocated during a test (sockets, memory, etc), reset state, or anything else that has no use after a test is run. _It is important to remember that you can not count on Jest running your tests in any particular order, so do not rely on the end state of one test as the starting state of another test._

Jest uses `beforeAll()`, `beforeEach()` for setup and `afterAll()` and `afterEach()` for teardown.  
`beforeAll()` and `afterAll()` are run once, before and after all the files in a particular block scope (either entire file, a describe block, or a single test). `beforeEach()`and `afterEach()` are run before and after each individual test in a block.

## Parameterized Tests

Often we want to run the same test code over and over with different data. Rather than copy/paste a test and changing a few items, look for ways to extract what is different into parameters, just as you would if you were going to turn a block of code into a more general function. A set of parameters used for a particular test run is typically refered to as a "Test Case". Jest provides a test.each() wrapper method to achieve this. The parameters are an array and each element can contain as much data as needed.

In the example below, we define our parameters to include a `string` to help identify the test case and a `MissionTask` to be used for the test run. We will put the test cases in an array named `validTaskTestCases` to pass to our parameterized test. Because there was a large number of different `MissionTask` objects to be tested, we put them in a `json` file to make the code cleaner and easier to add, modify, or delete test cases. (This same file of test cases is used in another test suite and contains both `validTaskTestCases` and a set of `invalidTaskTestCases`. For this test suite, we are only using the `validTaskTestCases`.)

```
import testCases from "./cases/missionTaskTestCases.json";
 ...
type TaskParams = {
    description: string;
    task: MissionTask;
};

type TaskTestCases = {
    validTaskTestCases: TaskParams[];
};

// Use all of the Valid Task Test Cases
const validTaskTestCases = (testCases as TaskTestCases).validTaskTestCases;
```

Next we declare our parameterized test. We use the `beforeEach()` method in a `describe` block to reset the Props used and to reset all mock data. We use `test.each(validTaskTestCases)` to tell Jest to run this test with each test case in the `validTaskTestCases`. We use the `description` of the test case to augment the test description to make the test output more useful and then pass the `task` of the test case into the test function as a parameter and add it to the default Props for our test.

```
describe("TaskSettingsPanel: Should update task type correctly for all options", () => {
    beforeEach(() => {
        resetProps();
        jest.clearAllMocks(); // Ensure a clean state for each test
    });

    test.each(validTaskTestCases)(
        "Input Task: $description, Select all Options",
        async ({ task }) => {

            // Add Test Case Task to Props
            mockProps.task = task;

```

Here is the output from the parameterized test:

```
  TaskSettingsPanel: Should update task type correctly for all options
    ✓ Input Task: Valid No Task, Select all Options (257 ms)
    ✓ Input Task: Valid Constant Heading, Select all Options (135 ms)
    ✓ Input Task: Valid Non-Bottom Dive, Select all Options (128 ms)
    ✓ Input Task: Valid Bottom Dive, Select all Options (127 ms)
    ✓ Input Task: Valid Surface Drift, Select all Options (121 ms)
    ✓ Input Task: Valid Station Keeping, Select all Options (119 ms)
    ✓ Input Task: Valid None Task Type, Select all Options (119 ms)
```

## Test Configuration

Our testing environment includes a lot of individual tools working together, each with their own configurations. Here we will discuss these but only focus on the test related configuration parameters.

### src/web/jest.config.js

Automatically reset the data associated with mock calls so it does not need to be done explicitly in a `beforeEach()` method

```
    // Automatically clear mock calls, instances, contexts and results before every test
    clearMocks: true,
```

Tell Jest to use `babel` for test coverage instrumentation. Currently we are not accessing any test coverage data.

```
    // Indicates which provider should be used to instrument code for coverage
    coverageProvider: "babel",
```

Tell Jest to use `file-mock.ts` to mock imports of image files and `style-mock.ts` to mock imports of `css` and `less` files

```
    // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
    moduleNameMapper: {
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
            "<rootDir>/tests/__mocks__/file-mock.ts",
        "\\.(css|less)$": "<rootDir>/tests/__mocks__/style-mock.ts",
    },
```

Tell Jest to ignore the files in the `dist` directory

```
    // An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
    modulePathIgnorePatterns: ["dist"],
```

Tell Jest to use ts-jest as the preset for translating Typescript

```
    // A preset that is used as a base for Jest's configuration
    preset: "ts-jest",
```

Tell Jest to run mocks for Web APIs and set global imports for `.test` files

```
    // The paths to modules that run some code to configure or set up the testing environment before each test
    setupFiles: ["<rootDir>/tests/jest.setup.js"],

    // A list of paths to modules that run some code to configure or set up the testing framework before each test
    setupFilesAfterEnv: ["<rootDir>/tests/setup-tests.ts"],
```

Tell Jest we want to use the `jsdom` for our testing environment

```
    // The test environment that will be used for testing
    testEnvironment: "jsdom",
```

Tell Jest to use `ts-jest` to translate `.ts` & `.tsx` files and to use `babel-jest` to translate `.js` & `.jsx` files.

```
    // A map from regular expressions to paths to transformers
    transform: {
        "^.+\\.(ts|tsx)?$": "ts-jest",
        "^.+\\.(js|jsx)$": "babel-jest",
    },
```

This parameter must be present. It tells Jest to ignore some files. We are not ignoreing any at this time.

```
    // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
    transformIgnorePatterns: [],
```

Runtime parameters for tests. We increased the `testTimeout` and reduced the `maxWorkers` to insure our tests can run in `CircleCI`. You may want to change these locally if you have a faster or slower machine.

```
    // Whether to use watchman for file crawling
    // watchman: true,
    testTimeout: 20000,
    maxWorkers: 2,
```

### src/web/tests/jest.setup.js

Configurations set on the [**global object**](https://developer.mozilla.org/en-US/docs/Glossary/Global_object) in the JavaScript environment

```
// Provide the Web API IndexedDB interface to Jest
import "fake-indexeddb/auto";

// Provide the Web API ResizeObserver interface to Jest
global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
        this.callback = callback;
    }

    observe(target) {
        this.callback([{ target }]);
    }

    unobserve() {}

    disconnect() {}
};

// Silence non error output while running tests
global.console.log = jest.fn();
global.console.debug = jest.fn();
```

### src/web/tsconfig.json

Tell Typescript to use the types in `@testing-library/jest-dom`

`"types": ["@testing-library/jest-dom", "@types/plotly.js"],`

Tell Typescript to exclude our test files from our application code base

`exclude": ["node_modules", "dist", "coverage", "webpack.*.js", "*.config.js", "*.test.ts*"]`
