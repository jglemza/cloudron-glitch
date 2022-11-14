Accounts are created with the username and the subdomain under which this app is installed  e.g. `@$CLOUDRON-USERNAME@$CLOUDRON-APP-FQDN`. Mastodon does not allow changing the domain part of the account later. See [the docs](https://docs.cloudron.io/apps/mastodon/#federation) for more information, if you want to change this domain.

<sso>
**NOTE:**
* Mastodon has [restrictions](https://docs.cloudron.io/apps/mastodon/#username-restriction) on usernames that might prevent some users from logging in.

* External registration [does not work well](https://github.com/mastodon/mastodon/issues/20655) when Cloudron user management is enabled.
</sso>

