#!/bin/bash

# Setup scaling related environment variables here - https://docs.joinmastodon.org/admin/scaling/

# Puma
export WEB_CONCURRENCY=2    # number of worker processes
export MAX_THREADS=5        # the number of threads per process

# Streaming API
export STREAMING_CLUSTER_NUM=1  # number of worker processes

# Sidekiq
export SIDEKIQ_THREADS=2
export DB_POOL=25               # must be at least the same as the number of threads

