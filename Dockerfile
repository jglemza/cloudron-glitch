FROM cloudron/base:4.0.0@sha256:31b195ed0662bdb06a6e8a5ddbedb6f191ce92e8bee04c03fb02dd4e9d0286df

RUN mkdir -p /app/code /app/pkg
WORKDIR /app/code

ARG NODE_VERSION=16.18.1
RUN mkdir -p /usr/local/node-${NODE_VERSION} && \
    curl -L https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz | tar zxf - --strip-components 1 -C /usr/local/node-${NODE_VERSION}
ENV PATH /usr/local/node-${NODE_VERSION}/bin:$PATH

RUN apt-get update && \
    apt install -y imagemagick ffmpeg libpq-dev libxml2-dev libxslt1-dev file git-core \
        g++ libprotobuf-dev protobuf-compiler pkg-config nodejs gcc autoconf \
        bison build-essential libssl-dev libyaml-dev libreadline6-dev \
        zlib1g-dev libncurses5-dev libffi-dev libgdbm-dev \
        nginx redis-server redis-tools postgresql postgresql-contrib \
        libidn11-dev libicu-dev libjemalloc-dev && \
    rm -rf /var/cache/apt /var/lib/apt/lists

# install rbenv since we need ruby 3.0.4
RUN mkdir -p /usr/local/rbenv && curl -LSs "https://github.com/rbenv/rbenv/archive/refs/tags/v1.2.0.tar.gz" | tar -xz -C /usr/local/rbenv --strip-components 1 -f -
ENV PATH /usr/local/rbenv/bin:$PATH
RUN mkdir -p "$(rbenv root)"/plugins/ruby-build && curl -LSs "https://github.com/rbenv/ruby-build/archive/refs/tags/v20221101.tar.gz" | tar -xz -C "$(rbenv root)"/plugins/ruby-build --strip-components 1 -f -

# install specific ruby version (https://github.com/mastodon/mastodon/blob/main/Dockerfile)
ARG RUBY_VERSION=3.0.4
RUN rbenv install ${RUBY_VERSION}
# this allows cloudron user to access ruby
RUN chmod o+rx /root
ENV PATH /root/.rbenv/versions/${RUBY_VERSION}/bin:$PATH

RUN gem install --no-document bundler

ENV RAILS_ENV production
ENV NODE_ENV production

ARG VERSION=4.0.2

RUN curl -L https://github.com/tootsuite/mastodon/archive/v${VERSION}.tar.gz | tar -xz --strip-components 1 -f - && \
    bundle config --local set deployment 'true' && \
    bundle config --local set without 'development test' && \
    bundle config --local set silence_root_warning true && \
    bundle install && \
    yarn install --pure-lockfile

# secret keys are not built into assets, so precompiling is safe to do here
# (these variables are required by rake though)
RUN SECRET_KEY_BASE=insecure.secret_key_base OTP_SECRET=insecure.otp_secret \
    bundle exec rake assets:precompile

# https://github.com/rubygems/bundler/issues/5245 means that bundle exec writes to Gemfile.lock
RUN ln -fs /run/mastodon/bullet.log /app/code/log/bullet.log && \
    rm -rf /app/code/tmp && ln -fs /tmp/mastodon /app/code/tmp && \
    mv /app/code/Gemfile.lock /app/code/Gemfile.lock.original && ln -s /run/mastodon/Gemfile.lock /app/code/Gemfile.lock

# add nginx config
RUN rm /etc/nginx/sites-enabled/* && \
    ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log
COPY nginx_readonlyrootfs.conf /etc/nginx/conf.d/readonlyrootfs.conf
COPY nginx/mastodon.conf /etc/nginx/sites-available/mastodon
RUN ln -s /etc/nginx/sites-available/mastodon /etc/nginx/sites-enabled/mastodon

# add supervisor configs
COPY supervisor/* /etc/supervisor/conf.d/
RUN ln -sf /run/mastodon/supervisord.log /var/log/supervisor/supervisord.log

RUN ln -fs /app/data/env.production /app/code/.env.production
RUN ln -fs /app/data/system /app/code/public/system

COPY start.sh cleanup.sh config.sh env.template /app/pkg/

CMD [ "/app/pkg/start.sh" ]

