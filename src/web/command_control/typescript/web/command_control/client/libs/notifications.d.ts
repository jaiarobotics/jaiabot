import 'toastr/toastr.less';
declare const messageLog: string[];
declare const info: (message: string) => void;
declare const warning: (message: string) => void;
declare const error: (message: string) => void;
declare const success: (message: string) => void;
declare const debug: (message: string) => void;
export { info, warning, error, success, debug, messageLog };
