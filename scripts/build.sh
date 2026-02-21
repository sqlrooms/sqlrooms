#!/usr/bin/env sh

if [ -n "$1" ]; then
  case "$1" in
    @sqlrooms/*) FILTER="$1" ;;
    *) FILTER="@sqlrooms/$1" ;;
  esac

  turbo build --filter="$FILTER"
else
  turbo build --filter=@sqlrooms/*
fi
