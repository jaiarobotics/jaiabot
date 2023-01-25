import $ from 'jquery';
import 'jquery-ui/ui/widgets/tooltip';
import 'jquery-ui/themes/base/tooltip.css';

export default function (container = '') {
  const selector = `${container} button[title], ${container} span[title]`;

  let selectorTarget = $(selector) as any

  selectorTarget.on("mousedown", (evt: Event) => {
    let currentTarget = $(evt.currentTarget) as any

    const timeout = window.setTimeout(() => {
      evt.stopPropagation();
      evt.preventDefault();

      currentTarget.tooltip('enable');
      currentTarget.tooltip('open');
      currentTarget.on("mouseup", (evnt: Event) => {
        evnt.stopPropagation();
        currentTarget.off('mouseup');
      });
      currentTarget.click((evnt: Event) => {
        evnt.stopPropagation();
        currentTarget.off('click');
      });
    }, 1000);

    currentTarget.on("mouseup", () => {
      // clear timeout for this element
      window.clearTimeout(timeout);
      // reset mouse up event handler
      $(evt.currentTarget).off('mouseup');
      return false;
    });
    return false;
  });

  selectorTarget.tooltip({
    disabled: true,
    close: (evt: Event, ui: any) => {
      let currentTarget = $(evt.currentTarget) as any
      currentTarget.tooltip('disable');
    },
    position: {
      my: 'left+10 center',
      at: 'right center',
      collision: 'flip none'
    }
  });
}
