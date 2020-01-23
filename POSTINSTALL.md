<sso>
This app integrates with Cloudron user management. Cloudron users can login and access
Mastodon.
</sso>

To make a user an administrator, use the [Web Terminal](https://cloudron.io/documentation/apps/#web-terminal)
and run the following command:

```
bin/tootctl accounts modify <username> --role admin
```

**IMPORTANT**: Before you start using the app, be sure to configure the [federation domain](https://cloudron.io/documentation/apps/mastodon/#federation-domain). The federation domain cannot be changed easily later.

