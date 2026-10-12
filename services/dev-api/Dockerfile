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

FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587

WORKDIR /srv/folder-server

COPY --from=builder /usr/local/cargo/bin/folder-server /usr/local/bin/folder-server
COPY data ./data

EXPOSE 4002

CMD ["folder-server", "./data", "--bind", "0.0.0.0:4002", "--readonly", "--cors-origin", "*"]
