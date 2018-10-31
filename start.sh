#!/bin/bash -eu
echo "=>Configuring mastodon<="
bash /app/code/mastodon.env.template > /app/data/.env.production

if ! [ -d /app/data/system ]; then
    echo "=>First run, generating keys and setting up the DB<="

    export RANDFILE=/tmp/.rnd
    echo -e "SECRET_KEY_BASE=$(openssl rand -hex 64)\nOTP_SECRET=$(openssl rand -hex 64)" | \
        tee /app/data/.keys.env >> /app/data/.env.production

    HOME=/app/data bundle exec rake mastodon:webpush:generate_vapid_key | \
        tee -a /app/data/.keys.env >> /app/data/.env.production

    SAFETY_ASSURED=1 HOME=/app/data bundle exec rails db:schema:load db:seed

    # the app writes to the following dirs:
    mkdir -p /app/data/system && chown cloudron:cloudron /app/data/system

else
    cat /app/data/.keys.env >> /app/data/.env.production
fi

echo "=>Starting mastodon<="

SUDO='sudo -u cloudron -H -E'
PORT=3000 $SUDO bundle exec puma -C config/puma.rb &
PORT=4000 STREAMING_CLUSTER_NUM=1 $SUDO npm run start &
DB_POOL=25 MALLOC_ARENA_MAX=2 $SUDO bundle exec sidekiq -c 25 &

mkdir -p /run/nginx/log /run/nginx/body /run/nginx/cache
nginx -g 'daemon off;'
