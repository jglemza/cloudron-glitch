FROM cloudron/base:1.0.0@sha256:147a648a068a2e746644746bbfb42eb7a50d682437cead3c67c933c546357617

RUN mkdir -p /app/code /app/pkg
WORKDIR /app/code

ARG VERSION=3.1.2

RUN apt-key adv --fetch-keys http://dl.yarnpkg.com/debian/pubkey.gpg && \
    echo "deb http://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update && \
    apt-get install -y yarn libprotobuf-dev protobuf-compiler libidn11-dev libicu-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm5 libgdbm-dev libicu-dev libssl-dev libyaml-dev libreadline6-dev libxml2-dev libxslt1-dev && \
    rm -rf /var/cache/apt /var/lib/apt/lists

RUN mkdir -p /usr/local/node-10.15.3 && \
    curl -L https://nodejs.org/dist/v10.15.3/node-v10.15.3-linux-x64.tar.gz | tar zxf - --strip-components 1 -C /usr/local/node-10.15.3

ENV PATH /usr/local/node-10.15.3/bin:$PATH

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

COPY start.sh env.template /app/pkg/

CMD [ "/app/pkg/start.sh" ]

