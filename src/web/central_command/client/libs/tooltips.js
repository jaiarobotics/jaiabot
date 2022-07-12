import $ from 'jquery';
import 'jquery-ui/ui/widgets/tooltip';
import 'jquery-ui/themes/base/tooltip.css';

export default function (container = '') {
  const selector = `${container} button[title], ${container} span[title]`;
  $(selector).mousedown((evt) => {
    const timeout = window.setTimeout(() => {
      evt.stopPropagation();
      evt.preventDefault();
      $(evt.currentTarget).tooltip('enable');
      $(evt.currentTarget).tooltip('open');
      $(evt.currentTarget).mouseup((evnt) => {
        evnt.stopPropagation();
        $(evt.currentTarget).off('mouseup');
      });
      $(evt.currentTarget).click((evnt) => {
        evnt.stopPropagation();
        $(evt.currentTarget).off('click');
      });
    }, 1000);
    $(evt.currentTarget).mouseup(() => {
      // clear timeout for this element
      window.clearTimeout(timeout);
      // reset mouse up event handler
      $(evt.currentTarget).off('mouseup');
      return false;
    });
    return false;
  });
  $(selector).tooltip({
    disabled: true,
    close: (evt, ui) => {
      $(evt.currentTarget).tooltip('disable');
    },
    position: {
      my: 'left+10 center',
      at: 'right center',
      collision: 'flip none'
    }
  });
}
