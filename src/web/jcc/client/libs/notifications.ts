// Toast notification used for giving feedback to user for broadcast commands where receiving ack is not feasible
import toastr from 'toastr';
import 'toastr/toastr.less';

toastr.options = {
  closeButton: false,
  debug: false,
  newestOnTop: false,
  progressBar: false,
  positionClass: 'toast-bottom-center',
  preventDuplicates: true,
  onclick: null,
  showDuration: 300,
  hideDuration: 1000,
  timeOut: 5000,
  extendedTimeOut: 1000,
  showEasing: 'swing',
  hideEasing: 'linear',
  showMethod: 'fadeIn',
  hideMethod: 'fadeOut'
};

const messageLog: string[] = [];

const info = function info(message: string) {
  console.log(`INFO ${message}`);
  messageLog.push(`INFO ${message}`);
  toastr.info(message);
};

const warning = function warning(message: string) {
  console.warn(`WARNING ${message}`);
  messageLog.push(`WARNING ${message}`);
  toastr.warning(message);
};

const error = function error(message: string) {
  console.error(`ERROR ${message}`);
  messageLog.push(`ERROR ${message}`);
  toastr.error(message);
};

const success = function success(message: string) {
  console.log(`SUCCESS ${message}`);
  messageLog.push(`SUCCESS ${message}`);
  toastr.success(message);
};

const debug = function debug(message: string) {
  console.log(`DEBUG ${message}`);
};

export {
  info, warning, error, success, debug, messageLog
};
