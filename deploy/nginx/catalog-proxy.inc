proxy_pass http://127.0.0.1:4000;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-API-Key $http_x_api_key;
proxy_set_header Cookie "";
proxy_set_header Authorization "";
proxy_set_header Origin "";
proxy_set_header X-CSRF-Token "";
proxy_connect_timeout 5s;
proxy_read_timeout 15s;
proxy_hide_header X-Powered-By;
# No proxy cache: unpublish/revocation must reach the inventory service.
