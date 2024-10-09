# CS Simulator

# import global obornes.commons.docker

requires:
    package "https://github.com/Obornes/fast-packages.git#/libs/obornes-commons"

name = "cs-simulator"
version = "1.0.0"
CLOUD_WS_URL = "wss://cpc.eu-stable.uat.charge.ampeco.tech:443/obornes"
CP_PASSWORD =  ""


goal start:
    - CP_ID "CS*SIMULATOR*1"
    sh: docker run -d --rm -v $(pwd):/app  \
        --name $name \
        -e WS_URL=$CLOUD_WS_URL \
        -e CP_ID=$CP_ID \
        -e PASSWORD=$CP_PASSWORD \
        ${name}:latest \
        npx tsx index_16.ts


goal stop:
    try sh: docker stop $name


goal shell:
    - CP_ID "CS*SIMULATOR*1"
    sh: docker run -it --rm -v $(pwd):/app  \
        --name $name \
        -e WS_URL=$CLOUD_WS_URL \
        -e CP_ID=$CP_ID \
        -e PASSWORD=$CP_PASSWORD \
        ${name}:latest \
        /bin/bash

goal notify:
    goal available:
        run("StatusNotification/available")
    goal charging:
        run("StatusNotification/charging")
    goal faulted:
        run("StatusNotification/faulted")
    goal finishing:
        run("StatusNotification/finishing")
    goal finished:
        run("StatusNotification/finished")
    goal preparing:
        run("StatusNotification/preparing")
    goal reserved:
        run("StatusNotification/reserved")
    goal second:
        run("StatusNotification/second")

goal docker:
    goal build:
        sh: docker buildx build -f ./devops/Dockerfile \
            -t ${name}:latest .

function run(cmd):
    sh.bind("{{name}}:latest/bin/ash")
    sh: npx tsx admin/v16/${cmd}