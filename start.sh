#!/usr/bin/env bash

ENV_FILE=$1
INDEX_FILE=$2

if [[ -z "$ENV_FILE" ]]; then
  echo "Usage: $0 [env-file] <index-file>"
  exit 1
fi

if [[ -z "$INDEX_FILE" ]]; then
  INDEX_FILE="$ENV_FILE"
  # defaulting to .env
  ENV_FILE=".env"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "$ENV_FILE" == ".env" ]]; then
    ENV_FILE=""
  else
    full_env_file=".env.$ENV_FILE"
    if [[ ! -f "$full_env_file" ]]; then
      echo "Environment file not found: $ENV_FILE"
      exit 1
    fi
    echo "Using environment file: $full_env_file"
    ENV_FILE="$full_env_file"
  fi
fi

if [[ -z "$ENV_FILE" ]]; then
  npx tsx $INDEX_FILE
else
  npx dotenvx run --env-file=$ENV_FILE -- tsx $INDEX_FILE
fi
