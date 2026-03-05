FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY src/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1
