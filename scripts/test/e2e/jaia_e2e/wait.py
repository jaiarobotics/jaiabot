"""Polling until a fleet reaches a state."""

import time


class WaitTimeout(Exception):
    pass


def wait_for(predicate, timeout, what, interval=5, progress=None, log=print,
             report_every=0, failure=WaitTimeout):
    """Polls predicate() until it is true, raising failure(...) once timeout passes.

    A predicate that raises is a broken check rather than a fleet that is not ready
    yet, so the exception comes straight back out instead of being retried.
    """
    deadline = time.time() + timeout
    last_report = 0.0
    while True:
        if predicate():
            return
        now = time.time()
        if now >= deadline:
            detail = f': {progress()}' if progress else ''
            raise failure(f'timed out after {timeout:.0f}s waiting for {what}{detail}')
        if now - last_report >= report_every:
            extra = f' ({progress()})' if progress else ''
            log(f'  waiting for {what}{extra}, {int(deadline - now)}s left')
            last_report = now
        time.sleep(interval)
