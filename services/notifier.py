import json
from urllib import request
from urllib.error import URLError, HTTPError


class WebhookNotifier:
    def post_markdown(self, webhook_url: str, title: str, content: str) -> tuple[bool, str]:
        if not webhook_url:
            return False, "webhook 未配置"

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "content": f"### {title}\n\n{content}",
            },
        }
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=8) as resp:
                body = resp.read().decode("utf-8", errors="ignore")
                if 200 <= resp.status < 300:
                    return True, body[:200]
                return False, f"HTTP {resp.status}: {body[:200]}"
        except HTTPError as e:
            return False, f"HTTPError: {e.code}"
        except URLError as e:
            return False, f"URLError: {e.reason}"
