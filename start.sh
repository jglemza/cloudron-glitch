#!/bin/bash -eu
echo "=>Configuring mastodon<="
bash /app/code/mastodon.env.template > /app/data/.env.production

if ! [ -f /app/data/.keys.env ]; then
    echo "=>First run, generating keys and setting up the DB<="
    export RANDFILE=/app/data/.rnd
    echo -e "SECRET_KEY_BASE=$(openssl rand -hex 64)\nOTP_SECRET=$(openssl rand -hex 64)" > /app/data/.keys.env

    source /app/data/.keys.env
    HOME=/app/data bundle exec rake mastodon:webpush:generate_vapid_key >> /app/data/.keys.env
    SAFETY_ASSURED=1 HOME=/app/data bundle exec rails db:schema:load db:seed

    # the app writes to the following dirs:
    mkdir -p /app/data/system && chown cloudron:cloudron /app/data/system
fi

cat /app/data/.keys.env >> /app/data/.env.production

echo "=>Starting mastodon<="

SUDO='sudo -u cloudron -H -E'
PORT=3000 $SUDO bundle exec puma -C config/puma.rb &
PORT=4000 STREAMING_CLUSTER_NUM=1 $SUDO npm run start &
DB_POOL=25 MALLOC_ARENA_MAX=2 $SUDO bundle exec sidekiq -c 25 &

mkdir -p /run/nginx/log /run/nginx/body /run/nginx/cache
nginx -g 'daemon off;'
