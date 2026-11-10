import { addDropdownListener } from "../style";

test("addDropdownListener's cleanup removes the listeners it added", () => {
    document.body.innerHTML = `
        <div id="list">
            <div class="accordion"></div>
            <div class="accordion"></div>
        </div>`;
    const accordions = Array.from(document.getElementsByClassName("accordion"));
    const addSpies = accordions.map((element) => jest.spyOn(element, "addEventListener"));
    const removeSpies = accordions.map((element) => jest.spyOn(element, "removeEventListener"));

    const removeListeners = addDropdownListener("accordion", "list");
    removeListeners();

    accordions.forEach((_, i) => {
        expect(addSpies[i]).toHaveBeenCalledTimes(1);
        expect(removeSpies[i]).toHaveBeenCalledTimes(1);
        expect(removeSpies[i]).toHaveBeenCalledWith("click", addSpies[i].mock.calls[0][1]);
    });
});
