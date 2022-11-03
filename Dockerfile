# Fetch the LiteFS binary using a multi-stage build.
FROM flyio/litefs:0.2 AS litefs

# Our final Docker image stage starts here.
FROM node:alpine

# Copy binaries from the previous build stages.
# COPY --from=builder /usr/local/bin/litefs-example /usr/local/bin/litefs-example
COPY --from=litefs /usr/local/bin/litefs /usr/local/bin/litefs

ENV NODE_ENV=production

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --production

COPY . .

# Copy our LiteFS configuration.
ADD etc/litefs.yml /etc/litefs.yml

# Setup our environment to include FUSE & SQLite.
RUN apk add bash curl fuse sqlite

# Ensure our mount & data directories exists before mounting with LiteFS.
RUN mkdir -p /data /mnt/data

# Run LiteFS as the entrypoint so it can execute "litefs-example" as a subprocess.
ENTRYPOINT "litefs"
