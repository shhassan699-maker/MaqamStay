# Include inside the catalog server block only.
if ($request_method != GET) { return 405; }
location = /api/v1/public/hotels { include /etc/nginx/maqamstay/catalog-proxy.inc; }
location = /api/v1/public/hotels/nearby { include /etc/nginx/maqamstay/catalog-proxy.inc; }
location ~ ^/api/v1/public/hotels/[a-z0-9]+(?:-[a-z0-9]+)*$ { include /etc/nginx/maqamstay/catalog-proxy.inc; }
location = /api/v1/public/cities { include /etc/nginx/maqamstay/catalog-proxy.inc; }
location = /api/v1/public/areas { include /etc/nginx/maqamstay/catalog-proxy.inc; }
location = /api/v1/public/landmarks { include /etc/nginx/maqamstay/catalog-proxy.inc; }
location ~ ^/api/v1/public/media/[a-f0-9]{24}$ { include /etc/nginx/maqamstay/catalog-proxy.inc; }
location ^~ /api/v1/admin/ { return 404; }
location ^~ /api/v1/auth/ { return 404; }
location ^~ /docs { return 404; }
location ^~ /health/ { return 404; }
location / { return 404; }
