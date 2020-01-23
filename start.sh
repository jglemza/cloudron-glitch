#!/bin/bash

set -eu

mkdir -p /tmp/mastodon /app/data/system /run/mastodon

if [[ ! -f /app/data/env.production ]]; then
    echo "==> Copying env template on first run"
    cp /app/pkg/env.template /app/data/env.production

    # LOCAL_DOMAIN is the federation domain. We only set this once on a fresh install
    # changing this will break federation
    sed -e "s/LOCAL_DOMAIN=.*/LOCAL_DOMAIN=${CLOUDRON_APP_DOMAIN}/g" -i /app/data/env.production
fi

echo "==> Configuring mastodon"
sed -e "s/DB_HOST=.*/DB_HOST=${CLOUDRON_POSTGRESQL_HOST}/g" \
    -e "s/DB_PORT=.*/DB_PORT=${CLOUDRON_POSTGRESQL_PORT}/g" \
    -e "s/DB_NAME=.*/DB_NAME=${CLOUDRON_POSTGRESQL_DATABASE}/g" \
    -e "s/DB_USER=.*/DB_USER=${CLOUDRON_POSTGRESQL_USERNAME}/g" \
    -e "s/DB_PASS=.*/DB_PASS=${CLOUDRON_POSTGRESQL_PASSWORD}/g" \
    -e "s/REDIS_HOST=.*/REDIS_HOST=${CLOUDRON_REDIS_HOST}/g" \
    -e "s/REDIS_PORT=.*/REDIS_PORT=${CLOUDRON_REDIS_PORT}/g" \
    -e "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=${CLOUDRON_REDIS_PASSWORD}/g" \
    -e "s/SMTP_SERVER=.*/SMTP_SERVER=${CLOUDRON_MAIL_SMTP_SERVER}/g" \
    -e "s/SMTP_PORT=.*/SMTP_PORT=${CLOUDRON_MAIL_SMTP_PORT}/g" \
    -e "s/SMTP_FROM_ADDRESS=.*/SMTP_FROM_ADDRESS=${CLOUDRON_MAIL_FROM}/g" \
    -e "s/SMTP_LOGIN=.*/SMTP_LOGIN=${CLOUDRON_MAIL_SMTP_USERNAME}/g" \
    -e "s/SMTP_PASSWORD=.*/SMTP_PASSWORD=${CLOUDRON_MAIL_SMTP_PASSWORD}/g" \
    -e "s/WEB_DOMAIN=.*/WEB_DOMAIN=${CLOUDRON_APP_DOMAIN}/g" \
    -i /app/data/env.production

if [[ -n "${CLOUDRON_LDAP_SERVER:-}" ]]; then
    sed -e "s/LDAP_ENABLED=.*/LDAP_ENABLED=true/g" \
        -e "s/LDAP_HOST=.*/LDAP_HOST=${CLOUDRON_LDAP_SERVER}/g" \
        -e "s/LDAP_PORT=.*/LDAP_PORT=${CLOUDRON_LDAP_PORT}/g" \
        -e "s/LDAP_BASE=.*/LDAP_BASE=${CLOUDRON_LDAP_USERS_BASE_DN}/g" \
        -e "s/LDAP_BIND_DN=.*/LDAP_BIND_DN=${CLOUDRON_LDAP_BIND_DN}/g" \
        -e "s/LDAP_BIND_PASSWORD=.*/LDAP_BIND_PASSWORD=${CLOUDRON_LDAP_BIND_PASSWORD}/g" \
        -i /app/data/env.production
else
    sed -e "s/LDAP_ENABLED=.*/LDAP_ENABLED=false/g" -i /app/data/env.production
fi

if grep -q "^SECRET_KEY_BASE=$" /app/data/env.production; then
    echo "==> Generating secrets"
    export RANDFILE=/tmp/.rnd
    sed -i -e "s/SECRET_KEY_BASE=.*/SECRET_KEY_BASE=$(openssl rand -hex 64)/" \
        -e "s/OTP_SECRET=.*/OTP_SECRET=$(openssl rand -hex 64)/" \
        /app/data/env.production

    echo "==> Generating vapid keys"
    HOME=/app/data bundle exec rake mastodon:webpush:generate_vapid_key >> /app/data/env.production

    echo "==> Init database"
    HOME=/app/data SAFETY_ASSURED=1 bundle exec rails db:schema:load db:seed

    if [[ -n "${CLOUDRON_LDAP_SERVER:-}" ]]; then
        echo "Disabling registration by default"
        PGPASSWORD=${CLOUDRON_POSTGRESQL_PASSWORD} psql -h ${CLOUDRON_POSTGRESQL_HOST} -p ${CLOUDRON_POSTGRESQL_PORT} -U ${CLOUDRON_POSTGRESQL_USERNAME} -d ${CLOUDRON_POSTGRESQL_DATABASE} \
            -c "INSERT INTO settings (var, value) VALUES ('registrations_mode', 'none')"
    fi
fi

chown -R cloudron:cloudron /app/data /tmp/mastodon /run/mastodon

echo "==> Starting mastodon"
exec /usr/bin/supervisord --configuration /etc/supervisor/supervisord.conf --nodaemon -i Mastodon

