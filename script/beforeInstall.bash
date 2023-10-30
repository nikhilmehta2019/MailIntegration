#!/usr/bin/env bash
 # I want to make sure that the directory is clean and has nothing left over from
 # previous deployments. The servers auto scale so the directory may or may not
 # exist.
 if [[ -d /usr/share/nginx/html ]] ; then
  rm -rf /usr/share/nginx/html
 fi
 mkdir -vp /usr/share/nginx/html
