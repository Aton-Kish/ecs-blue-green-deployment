# syntax=docker/dockerfile:1
FROM nginx:stable-alpine-slim

ARG COLOR
ARG DATE

COPY <<index.html /usr/share/nginx/html/
<html>
    <head>
        <title>ECS Blue/Green Deployment</title>
        <style>
            body {
                background-color: ${COLOR};
            }
        </style>
    </head>
    <body>
        <div>
            <h1>ECS Blue/Green Deployment</h1>
            <h2>Built: ${DATE}</h2>
            <p>Your application is now running on a container in Amazon ECS.</p>
        </div>
    </body>
</html>
index.html

EXPOSE 80
