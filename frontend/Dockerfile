# Frontend Dockerfile for Cloud Run
FROM node:18-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html

# Create a template for nginx to automatically substitute the PORT variable
RUN mkdir -p /etc/nginx/templates && echo 'server { listen ${PORT}; server_name localhost; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/templates/default.conf.template

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
