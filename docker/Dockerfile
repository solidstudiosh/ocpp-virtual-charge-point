FROM node:23.11.0-alpine

ARG STACK_TRACE_LIMIT=1024
ARG MAX_OLD_SPACE_SIZE=768

ENV NODE_OPTIONS="--stack-trace-limit=${STACK_TRACE_LIMIT} --max-old-space-size=${MAX_OLD_SPACE_SIZE}"

COPY . ./
RUN npm ci
ENTRYPOINT [ "npm" "run" "start" ]