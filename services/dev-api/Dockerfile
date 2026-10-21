FROM rust:1.88-bookworm@sha256:af306cfa71d987911a781c37b59d7d67d934f49684058f96cf72079c3626bfe0 AS builder

ARG FOLDER_SERVER_REF=2122013bd47230429bf237bfc11c36d40fdbd25f

RUN mkdir -p /tmp/folder-server \
  && cd /tmp/folder-server \
  && git init \
  && git remote add origin https://github.com/moritzbrantner/folder-server.git \
  && git fetch --depth 1 origin ${FOLDER_SERVER_REF} \
  && git checkout FETCH_HEAD \
  && cargo build --release \
  && cp target/release/folder-server /usr/local/cargo/bin/folder-server

FROM debian:bookworm-slim@sha256:7ff6ba31527b9e336162fa061746c366c4b2032f4d2cff2078bea43f78efe3f8

WORKDIR /srv/folder-server

COPY --from=builder /usr/local/cargo/bin/folder-server /usr/local/bin/folder-server
COPY data ./data

EXPOSE 4002

CMD ["folder-server", "./data", "--bind", "0.0.0.0:4002", "--readonly", "--cors-origin", "*"]
