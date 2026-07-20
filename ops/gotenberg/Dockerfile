FROM golang:1.26.2-bookworm@sha256:47ce5636e9936b2c5cbf708925578ef386b4f8872aec74a67bd13a627d242b19 AS gotenberg-builder

ARG GOTENBERG_SOURCE_COMMIT=98fc40347885ad510a311b990a73397c6d4143db
ARG GOTENBERG_SOURCE_SHA256=7aa20a8062bb170f3f9931eb35be3bf24479b9298f48ebe49e28a8d3ce45d947
ARG GOTENBERG_VERSION=8.34.0-lims.1

WORKDIR /src

RUN apt-get update --quiet \
    && apt-get install --yes --quiet --no-install-recommends \
      ca-certificates \
      curl \
      patch \
    && curl --fail --location --silent --show-error \
      "https://codeload.github.com/gotenberg/gotenberg/tar.gz/${GOTENBERG_SOURCE_COMMIT}" \
      --output /tmp/gotenberg.tar.gz \
    && echo "${GOTENBERG_SOURCE_SHA256}  /tmp/gotenberg.tar.gz" \
      | sha256sum --check \
    && tar --extract --gzip --file /tmp/gotenberg.tar.gz \
      --strip-components=1 \
    && rm -rf /tmp/gotenberg.tar.gz /var/lib/apt/lists/*

COPY fail-closed-resource-policy.patch /tmp/fail-closed-resource-policy.patch

RUN patch --forward --strip=1 < /tmp/fail-closed-resource-policy.patch \
    && go mod download \
    && go mod verify \
    && go test ./pkg/modules/chromium \
    && CGO_ENABLED=0 go build \
      -trimpath \
      -ldflags "-s -w -X 'github.com/gotenberg/gotenberg/v8/cmd.Version=${GOTENBERG_VERSION}'" \
      -o /out/gotenberg \
      cmd/gotenberg/main.go

FROM gotenberg/gotenberg:8.34.0@sha256:67097317623a503ba2a6a7e9ae8db6929a1f7e1bbd88077bacf2d325fbdab923

USER root

ARG DEBIAN_FRONTEND=noninteractive

COPY --from=gotenberg-builder /out/gotenberg /usr/bin/gotenberg

RUN echo "deb http://deb.debian.org/debian trixie contrib non-free" \
      > /etc/apt/sources.list.d/contrib.list \
    && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" \
      | debconf-set-selections \
    && apt-get update --quiet \
    && apt-get install --yes --quiet --no-install-recommends \
      ca-certificates \
      wget \
      ttf-mscorefonts-installer \
    && fc-cache --force \
    && fc-match "Times New Roman" | grep --ignore-case "Times New Roman" \
    && rm -rf /var/lib/apt/lists/*

USER gotenberg
