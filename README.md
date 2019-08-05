# lambda-get-pagespeed

## usage

### local

create env.json

```json
{
  "crawl": {
    "TEST_URL": "https://www.google.com/",
    "WEBHOOK_URL": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  }
}
```

execute AWS SAM

```js
echo '{}' | sam local invoke crawl --env-vars env.json
```
