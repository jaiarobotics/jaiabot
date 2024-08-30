
While trying to test the TaskSettingsPanel I have found that often tests that run in a suggested npm environment either fail or do not parse correctly when run in the jaiabot/src/web environment.  Ed has confirmed this and was able to get one of the example tests to pass in jaiabot environment by modifying the package.json file, adding "jest": "^27.5.1".  At the very least this exercise has exposed our current npm environment is full of depricated and unsupported modules, many of which are flagged as "critical" by npm audit.

I've tried working on example tests in both plain javascirpt and typescript and have found that Typescript tests in particular are very sensitive to environment deltas.  I assume this is due to all of the required bable modules used to compile them into javascript.  

One item in particular stands out as an issue that should be addressed.  In jaiabot we are using core-js.2.6.12 which has been flagged as very buggy and very poor performance.  We should be using 
core-js@3.21.0.

We do not specify core-js but it is being loaded by one of our obsolete babel modules.
web@ /home/jeff/jaiabot/src/web
└─┬ babel-polyfill@6.26.0
  ├─┬ babel-runtime@6.26.0
  │ └── core-js@2.6.12 deduped
  └── core-js@2.6.12

Many of the examples I found on the web are built using react-scripts and I think one of the reasons they work in their own environment and not in jaiabot is becuase it forces it to load newer versions of things we need.  For example

mui-testing@0.1.0 /home/jeff/MUItesting.com
└─┬ react-scripts@5.0.0
  └─┬ react-app-polyfill@3.0.0
    └── core-js@3.21.0

Note that babel-polyfill is no longer supported and should be replaced with react-app-polyfill@3.0.0

One of the problems I ran into trying to follow patterns found on the web was different versions of typescript have stronger typechecking.  Ed fixed one of the example tests by allowing a callback to except any instead of a specific type.

Other npm package issues I think will help.

I added "@testing-library/jest-dom": "^6.0.0", "eslint-plugin-testing-library" : "^6.3.0",
"eslint-plugin-jest-dom" : "^5.4.0" to package.json and these did clear up some of the issues I had running tests in jaiabot environment.

Michael did a GREAT job exploring the tests of JaiaToggle, much appreciated!

I would like to be able to download what he tested and try it on my machine if possible.

"In conclusion, `screen` values saved to variables remain unchanged regardless of changes that happen from firing events."

I have found this to be dependent on the environment as I have tried tests both using variables and without.  I think this is tied to issues described above.  Example...

test("flipping switch changes boolean", async () => {
    render(<SwitchPage />);
    const switchComponent = screen.getByRole("checkbox");
    expect(switchComponent).not.toBeChecked();
    userEvent.click(switchComponent);
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(switchComponent).toBeChecked();
});

This test is a modified version of the one found in https://github.com/pham-andrew/MUItesting.com, which is a great resource as it has examples of most MUI components we use.

Note that I saved switchComponent into a variable, triggered the userEvent.click on it and then verified it changed from not checked to checked.  It passes when run in it's native environment but fails in our environment. (surprisingly it fails on the line expect(screen.getByText("true")).toBeInTheDocument();)


As explained in the meeting, most of the articles I have read on React Testing recommend using userEvent instead of fireEvent.  userEvent more closely mimics how a user interacts with the page while fireEvent works directly with the dom and does not exercise all of the actions of the application components.

A good example of this is in "TaskSettingsPanel Select Bottom Dive BadBottom Dive Task" part of the draft PR I created.

   test("TaskSettingsPanel Select Bottom Dive BadBottom Dive Task", async () => {
        render(<TaskSettingsPanel {...mockBADBottomDiveProps} />);
        const taskSelectElement = screen.getByTestId("taskSelect");
        expect(taskSelectElement).toHaveTextContent(/None/i);
        expect(taskSelectElement).toHaveTextContent(/Dive/i);
        //This approach relies on native={true} in the Select component
        //https://stackoverflow.com/questions/55184037/react-testing-library-on-change-for-material-ui-select-component

        // Dig deep to find the actual <select>
        const selectNode = taskSelectElement.childNodes[0].childNodes[0];
        expect(selectNode).toHaveValue("NONE");
        expect(selectNode).not.toHaveValue("DIVE");
        fireEvent.change(selectNode, { target: { value: "DIVE" } });
        expect(selectNode).toHaveValue("DIVE");
        expect(selectNode).not.toHaveValue("NONE");
        //mockOnChangeCheckParameters()
    });

Note that fireEvent.change does in fact change the value of the Select component but it does so without manipulating the button that is actually clicked by the user.  Because of thie onChange={(evt) => onChangeTaskType(evt)} of the Select is not called with the correct evt and that caused the test to fail.  I think we should try to use userEvent whenever possible.

Regarding the useState I assumed that components onClick and onChange callbacks in the panel code would have contained the necessary functionality since manually testing in the jcc environment showed the bug fix in PR#950 solved the reported problem.  I did not realize that may rely on functionality in the parent nodes.

Given the code works when tested in a browser we should be able to mimic necessary behavior in our tests by providing the right call back as the onChange prop.  I was trying to use a callback method in the tests in my PR to verify certain attributes of the task passed out.  Unfortunately I never got this to work and my function was never getting called.  I think the reason is that the onChange method of the MUI Select is not getting called because of the fireEvent issues discussed above.  I never confirmed that becuase I never found a way to fix make the Select component call onChangeTaskType(evt), which in turn should have called the callback provided in the onChange prop.  It is possible the problem is in how I set up the funciton used as the mock callback.

If we intend to write integration tests we need to be able to provide mocked callback functions and verify the data passed out.  

Since the bug that was fixed involved modifying the code in the TaskSettingsPanel onChangeTaskType function we need to be able to test it at that level.  Exercising the "Switch to Bottom Dive" JaiaToggle is an important building block but does not insure the bug was fixed and will not catch it if it is re-introduced.  It is worth noting that handleToggle called by the "Switch to Bottom Dive" JaiaToggle calls the onChange method from the props of the TaskOptionsPanel, which in turn should call the onChange method from the props of the TaskSettingsPanel this event should have triggered the onChange method declared in the test code and passed in as a prop.  If we figure out how to properly use mocked callbacks I think we can fully test this with the existing applicatioon code.

General comments on testing MUI Components.

These components yield highly nested HTML and it is very hard to get the right element you want to evaluate or trigger.  It seems the Select is probably the worst of all.  I did find that using native=true when declaring it produce much simpler HTML and I did make some progress using that method.  I got stuck on triggering the call back methods as described above.

All of the blogs and examples I have read recommend using the inputProps to set things you can query in tests.  You can use "title" or "label" or "data-testid" (last resort).  Supposedly MUI includes this prop specificall to support testing and those props should be passed down to whatever the underlying input element is.  I have not been able to use this correctly yet but think it is an important building block for creating robust tests.

General Thoughts on testing

Unit and integration tests provide the most value when they catch unintended bugs introduce by tangential changes to code that break something else due to unexpected side effects.  To achieve this Unit tests should exercise all the internal functionality of the unit and Integtration tests should verify the correct outputs are generated with all possible sets of inputs.  For React pages the unit test should exercise all of the widgets the user interacts with.  React integtration tests should verify that all possible sets of Props and any other outside data sources like GlobalSettings result in valid outputs sent to callbacks passed in as Props as well as the final state of any modified data (GlobalSettings)

I had trouble trying to call the Save function for GlobalSettings, I think this is another important building block to testing.

