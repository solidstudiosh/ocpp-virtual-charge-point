# Charge Station Simulator
# OCPP 1.6

import global obornes.commons.aws
import global obornes.commons.docker
import obornes.commons.github

requires:
    package "https://github.com/Obornes/fast-packages.git#/libs/obornes-commons"

name = "cs-simulator"
version = "1.0.3"
CLOUD_WS_URL = "wss://cpc.eu-stable.uat.charge.ampeco.tech:443/obornes"
CP_PASSWORD =  ""
CP_ID = "CS*SIMULATOR*1"


SANDBOX = "sdbx"
INTEGRATION = "int"
STAGING = "stg"
PRODUCTION = "prod"
ENVIRONMENTS = [SANDBOX, INTEGRATION, STAGING, PRODUCTION]

image_name = DOCKER_REGISTRY + "/" + name
hash_git = sh: git rev-parse --short HEAD
full_image_name       = image_name + ":git-" + version + "-" + hash_git
release_image_name    = image_name + ":v" + version



goal dockerize:
    goal build:
        sh: docker buildx build --load -f ./devops/Dockerfile \
            -t ${name}:latest .
    goal shell:
        - CP_ID DEFAULT_CP_ID
        sh: docker run -it --rm \
            --name $name \
            --entrypoint /bin/ash \
            -e WS_URL=$CLOUD_WS_URL \
            -e CP_ID=$CP_ID \
            -e PASSWORD=$CP_PASSWORD \
            ${name}:latest

function run(cmd):
    sh: docker exec -t ${name} npx tsx admin/v16/${cmd}


goal terraform:
    goal prepare:sh:
        rm -rf tf-modules
        mkdir -p tf-modules
        gh repo clone "https://github.com/Obornes/terraform-modules.git" tf-modules/terraform-modules || true

goal github:
    goal release:
        goal create:
            do obornes.commons.github.github:release:create release_version=version image_tag=release_image_name

# Application management
goal app:
    goal start:
        - CP_ID DEFAULT_CP_ID
        sh: docker run --rm -t \
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

    goal authorize:
        goal ok:
            run("Authorize/authorize")
        goal ko:
            run("Authorize/authorize-non-existing")

    goal data:
        goal transfer:
            run("DataTransfer/dataTransfer")

    goal pack:
        - platform "linux/amd64" ["linux/amd64","linux/arm64"]
        - cache "local"
        - target "--target builder-stage"
        do docker:build platform=platform cache=cache dockerfile="./devops/Dockerfile"  tag=full_image_name target=target

    goal release:
        do docker:release tag=full_image_name

    goal deploy:
        - env "sdbx" [*ENVIRONMENTS] !
        do terraform:prepare
        sh.bind("hashicorp/terraform:latest/bin/ash?v=aws:/root/.aws&it=false&timeout=600")
        sh: terraform -chdir=deploy/${name}/${env} init
        goal plan:sh:
            terraform -chdir=deploy/${name}/${env} plan -var="app_task_container_image=${full_image_name}"

        goal apply:sh:
            terraform -chdir=deploy/${name}/${env} apply -auto-approve -var="app_task_container_image=${full_image_name}"

        goal destroy:sh:
            terraform -chdir=deploy/${name}/${env} destroy -auto-approve -var="app_task_container_image=${full_image_name}"

        goal state:
            goal force_unlock:
                - lock_id!
                sh: terraform -chdir=deploy/${name}/${env} force-unlock -force ${lock_id}

    goal image:
        goal full_name:sh:
            echo "${full_image_name}"

        goal pull:sh:
            docker pull "${full_image_name}"

        goal tag_base_image:
            sh: docker tag ${full_image_name} ${release_image_name}
            do docker:release tag=release_image_name