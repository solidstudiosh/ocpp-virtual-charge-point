# Charge Station Simulator
# OCPP 1.6

# import global obornes.commons.docker

requires:
    package "https://github.com/Obornes/fast-packages.git#/libs/obornes-commons"

name = "cs-simulator"
version = "1.0.0"
CLOUD_WS_URL = "wss://cpc.eu-stable.uat.charge.ampeco.tech:443/obornes"
CP_PASSWORD =  ""
DEFAULT_CP_ID = "CS*SIMULATOR*1"


goal start:
    - CP_ID DEFAULT_CP_ID
    sh: docker run --rm -t -v $(pwd):/app  \
        --name $name \
        -e WS_URL=$CLOUD_WS_URL \
        -e CP_ID=$CP_ID \
        -e PASSWORD=$CP_PASSWORD \
        ${name}:latest \
        npx tsx index_16.ts &

goal stop:
    try sh: docker stop $name

goal restart:
    do stop
    do start

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

goal transaction:
    goal start:
        run("Transaction/startTransaction")
    goal start_reserved:
        run("Transaction/startTransaction-reserved")
    goal stop:
        run("Transaction/stopTransaction")
    goal meter_values:
        run("Transaction/meterValues")
    goal meter_values_pai:
        run("Transaction/meterValues_PowerActiveImport")

goal docker:
    goal build:
        sh: docker buildx build -f ./devops/Dockerfile \
            -t ${name}:latest .
    goal shell:
        - CP_ID DEFAULT_CP_ID
        sh: docker run -it --rm -v $(pwd):/app  \
            --name $name \
            --entrypoint /bin/ash \
            -e WS_URL=$CLOUD_WS_URL \
            -e CP_ID=$CP_ID \
            -e PASSWORD=$CP_PASSWORD \
            ${name}:latest

function run(cmd):
    sh: docker exec -t ${name} npx tsx admin/v16/${cmd}
