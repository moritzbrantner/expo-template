FROM rust:1.99-bookworm@sha256:9181b56c2a21ab1d5e73cffe04fc762426d30aa7fac3c91141dd033f49a7fc8b AS builder

ARG FOLDER_SERVER_REF=2122013bd47230429bf237bfc11c36d40fdbd25f

RUN mkdir -p /tmp/folder-server \
  && cd /tmp/folder-server \
  && git init \
  && git remote add origin https://github.com/moritzbrantner/folder-server.git \
  && git fetch --depth 1 origin ${FOLDER_SERVER_REF} \
  && git checkout FETCH_HEAD \
  && cargo build --release \
  && cp target/release/folder-server /usr/local/cargo/bin/folder-server

FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3

WORKDIR /srv/folder-server

COPY --from=builder /usr/local/cargo/bin/folder-server /usr/local/bin/folder-server
COPY data ./data

EXPOSE 4002

CMD ["folder-server", "./data", "--bind", "0.0.0.0:4002", "--readonly", "--cors-origin", "*"]
