FROM rust:1.100-bookworm@sha256:ade39a710ef85f3506cffcfec3e8a24ba090badef1dff2fb798f71d878833fea AS builder

ARG FOLDER_SERVER_REF=2122013bd47230429bf237bfc11c36d40fdbd25f

RUN mkdir -p /tmp/folder-server \
  && cd /tmp/folder-server \
  && git init \
  && git remote add origin https://github.com/moritzbrantner/folder-server.git \
  && git fetch --depth 1 origin ${FOLDER_SERVER_REF} \
  && git checkout FETCH_HEAD \
  && cargo build --release \
  && cp target/release/folder-server /usr/local/cargo/bin/folder-server

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc

WORKDIR /srv/folder-server

COPY --from=builder /usr/local/cargo/bin/folder-server /usr/local/bin/folder-server
COPY data ./data

EXPOSE 4002

CMD ["folder-server", "./data", "--bind", "0.0.0.0:4002", "--readonly", "--cors-origin", "*"]
