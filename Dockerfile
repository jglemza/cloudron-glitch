FROM cloudron/base:2.0.0@sha256:f9fea80513aa7c92fe2e7bf3978b54c8ac5222f47a9a32a7f8833edf0eb5a4f4

RUN mkdir -p /app/code /app/pkg
WORKDIR /app/code

ARG VERSION=3.2.2

RUN apt-get update && \
    apt install -y imagemagick ffmpeg libpq-dev libxml2-dev libxslt1-dev file git-core \
        g++ libprotobuf-dev protobuf-compiler pkg-config nodejs gcc autoconf \
        bison build-essential libssl-dev libyaml-dev libreadline6-dev \
        zlib1g-dev libncurses5-dev libffi-dev libgdbm-dev \
        nginx redis-server redis-tools postgresql postgresql-contrib \
        certbot python-certbot-nginx yarn libidn11-dev libicu-dev libjemalloc-dev && \
    rm -rf /var/cache/apt /var/lib/apt/lists

RUN gem install --no-document bundler

ENV RAILS_ENV production
ENV NODE_ENV production
RUN curl -L https://github.com/tootsuite/mastodon/archive/v${VERSION}.tar.gz | tar -xz --strip-components 1 -f - && \
    bundle config set deployment 'true' && \
    bundle install --without test development && \
    yarn install --pure-lockfile

# secret keys are not built into assets, so precompiling is safe to do here
# (these variables are required by rake though)
RUN SECRET_KEY_BASE=insecure.secret_key_base OTP_SECRET=insecure.otp_secret \
    bundle exec rake assets:precompile

# add nginx config
USER root
RUN rm /etc/nginx/sites-enabled/*
RUN ln -sf /dev/stdout /var/log/nginx/access.log
RUN ln -sf /dev/stderr /var/log/nginx/error.log
ADD nginx_readonlyrootfs.conf /etc/nginx/conf.d/readonlyrootfs.conf
COPY nginx/mastodon.conf /etc/nginx/sites-available/mastodon
RUN ln -s /etc/nginx/sites-available/mastodon /etc/nginx/sites-enabled/mastodon

# add supervisor configs
ADD supervisor/* /etc/supervisor/conf.d/
RUN ln -sf /run/mastodon/supervisord.log /var/log/supervisor/supervisord.log

RUN ln -fs /app/data/env.production /app/code/.env.production
RUN ln -fs /run/mastodon/bullet.log /app/code/log/bullet.log
RUN ln -fs /app/data/system /app/code/public/system
RUN rm -rf /app/code/tmp && ln -fs /tmp/mastodon /app/code/tmp

COPY start.sh cleanup.sh env.template /app/pkg/

CMD [ "/app/pkg/start.sh" ]

