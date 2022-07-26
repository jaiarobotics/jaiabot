#!/bin/bash

sudo date -d "$(wget --method=HEAD -qSO- --max-redirect=0 google.com 2>&1 | grep Date: | sed s/Date://g)"
