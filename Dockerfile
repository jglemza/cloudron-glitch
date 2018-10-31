FROM cloudron/base:1.0.0

RUN mkdir -p /app/code
WORKDIR /app/code

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

# the following does apt-get update
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -

RUN apt-get install -y \
    imagemagick ffmpeg libpq-dev libxml2-dev libxslt1-dev file git-core \
    g++ libprotobuf-dev protobuf-compiler pkg-config nodejs gcc autoconf \
    bison build-essential libssl-dev libyaml-dev libreadline6-dev \
    zlib1g-dev libncurses5-dev libffi-dev libgdbm5 libgdbm-dev \
    nginx redis-server redis-tools postgresql postgresql-contrib \
    certbot yarn libidn11-dev libicu-dev libjemalloc-dev \
    ruby2.5

RUN gem install bundler --no-ri --no-rdoc

RUN rm -r /etc/nginx/sites-enabled/default /var/lib/nginx /var/log/nginx
RUN mkdir -p /run/nginx && ln -fs /run/nginx /var/lib/nginx && ln -fs /run/nginx/log /var/log/nginx

RUN git init && \
    git remote add origin https://github.com/tootsuite/mastodon.git && \
    git fetch --depth=1 origin $(git ls-remote --tags | grep refs/tags | grep -v 'rc[0-9]*$' | cut -f2 | sort -V | tail -n 1 | cut -d '/' -f3-) && \
    git checkout FETCH_HEAD

RUN bundle install -j$(getconf _NPROCESSORS_ONLN) --deployment --without development test && \
    yarn install --pure-lockfile

ENV GEM_PATH=/app/code/vendor/bundle/ruby/2.5.0/gems/ RAILS_ENV=production NODE_ENV=production

# secret keys are not built into assets, so precompiling is safe to do here
# (these variables are required by rake though)
RUN SECRET_KEY_BASE=insecure.secret_key_base OTP_SECRET=insecure.otp_secret \
    bundle exec rake assets:precompile

RUN ln -fs /app/data/.env.production /app/code/.env.production
RUN ln -fs /app/data/bullet.log /app/code/log/bullet.log
RUN ln -fs /app/data/system /app/code/public/system
RUN rm -rf /app/code/tmp && ln -fs /tmp /app/code/tmp

CMD /app/code/start.sh

COPY nginx.conf /etc/nginx/sites-enabled/mastodon
COPY mastodon.env.template /app/code
COPY start.sh /app/code
