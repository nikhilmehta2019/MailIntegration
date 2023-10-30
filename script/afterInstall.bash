cd /usr/share/nginx/html
chown -R share-data:share-data /usr/share/nginx/html
chmod -R 775 /usr/share/nginx/html
service nginx restart
