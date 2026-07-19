FROM gotenberg/gotenberg:8.34.0@sha256:67097317623a503ba2a6a7e9ae8db6929a1f7e1bbd88077bacf2d325fbdab923

USER root

ARG DEBIAN_FRONTEND=noninteractive

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
