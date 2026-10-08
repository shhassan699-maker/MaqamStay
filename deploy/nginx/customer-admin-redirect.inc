# Do not forward mutation bodies between hosts.
if ($request_method !~ ^(GET|HEAD)$) { return 405; }
return 307 https://maqamstay-crm.169-58-95-12.sslip.io$request_uri;
