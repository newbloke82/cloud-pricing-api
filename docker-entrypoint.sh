#!/usr/bin/env bash
set -e

## Run startup command 
echo "Running Start Up Script__"

## Set default updater to All if none specified
if [[ -z "${CLOUD_PROVIDER}" ]]; then
  UPDATE_PARAM="All"
else
  UPDATE_PARAM="${CLOUD_PROVIDER}"
fi

case $UPDATE_PARAM in

  "All")
	  npm run update
    ;;

  "AWS")
    npm run update -- --only=aws:bulk
    npm run update -- --only=aws:spot
    ;;

  "Azure" | "AzureRM")
    npm run update -- --only=azure:retail
    ;;

  "GCP" | "Google")
    npm run update -- --only=gcp:catalog
	  npm run update -- --only=gcp:machineTypes
    ;;

  *)
    echo -n "Unknown Updater Selected"
    ;;
esac

## Running passed command
if [[ "$1" ]]; then
	eval "$@"
fi
