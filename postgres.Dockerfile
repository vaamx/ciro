FROM ***REMOVED***:latest

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    ***REMOVED***ql-server-dev-all \
    && rm -rf /var/lib/apt/lists/*

# Clone and install pgvector
RUN git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install

# Create initialization script to enable extensions
COPY ./***REMOVED***-init.sql /docker-entrypoint-initdb.d/

# Clean up
RUN apt-get purge -y --auto-remove build-essential git ***REMOVED***ql-server-dev-all 