<sso>
This app integrates with Cloudron user management. Cloudron users can login and access
Mastodon.
</sso>

To make a user an administrator, use the [Web Terminal](https://cloudron.io/documentation/apps/#web-terminal)
and run the following command:

```
bin/tootctl accounts modify <username> --role admin
```

